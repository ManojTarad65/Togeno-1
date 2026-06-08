import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { notificationService } from "./notification.service";

// ---------------------------------------------------------------------------
// Commission slabs
// ---------------------------------------------------------------------------
//
// Order amount   | Platform commission % | Expert payout %
// ₹0    – ₹999  |        22%            |      18%
// ₹1000 – ₹2999 |        18%            |      15%
// ₹3000+         |        15%            |      12%
//
// platform_margin = total_commission - expert_payout

interface CommissionSlab {
  maxAmount: number; // exclusive upper bound (Infinity for the last slab)
  platformRate: number; // as a decimal, e.g. 0.22
  expertRate: number;
}

const SLABS: CommissionSlab[] = [
  { maxAmount: 1000, platformRate: 0.22, expertRate: 0.18 },
  { maxAmount: 3000, platformRate: 0.18, expertRate: 0.15 },
  { maxAmount: Infinity, platformRate: 0.15, expertRate: 0.12 },
];

function getSlab(amount: number): CommissionSlab {
  return SLABS.find((s) => amount < s.maxAmount) ?? SLABS[SLABS.length - 1];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommissionRow {
  id: string;
  order_id: string;
  expert_id: string | null;
  order_amount: number;
  total_commission: number;
  expert_payout: number;
  platform_margin: number;
  status: "pending" | "reserved" | "paid" | "reversed";
  reversed_at: string | null;
  withdrawal_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  orderId: string;
  expertId: string | null;
  orderAmount: number;
  totalCommission: number;
  expertPayout: number;
  platformMargin: number;
  status: "pending" | "reserved" | "paid" | "reversed";
  reversedAt: string | null;
  withdrawalRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toCommission(row: CommissionRow): Commission {
  return {
    id: row.id,
    orderId: row.order_id,
    expertId: row.expert_id ?? null,
    orderAmount: row.order_amount,
    totalCommission: row.total_commission,
    expertPayout: row.expert_payout,
    platformMargin: row.platform_margin,
    status: row.status,
    reversedAt: row.reversed_at,
    withdrawalRequestId: row.withdrawal_request_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CommissionService {
  /**
   * Calculate and persist commission when an order is DELIVERED.
   * If a commission already exists for this order, it is a no-op (idempotent).
   *
   * expertId — only set when the order came from a specific expert's post review.
   *            If null, expertPayout is 0 (platform keeps the full commission).
   */
  async calculateAndStore(
    orderId: string,
    orderAmount: number,
    expertId?: string | null,
  ): Promise<Commission> {
    // Idempotency: skip if already calculated
    const existing = await this.getByOrderId(orderId);
    if (existing) {
      logger.info("Commission already exists for order, skipping", { orderId });
      return existing;
    }

    const slab = getSlab(orderAmount);
    const totalCommission = round2(orderAmount * slab.platformRate);
    // Expert only earns if the order was placed from their post review
    const expertPayout = expertId ? round2(orderAmount * slab.expertRate) : 0;
    const platformMargin = round2(totalCommission - expertPayout);

    const { data, error } = await supabaseAdmin
      .from("commissions")
      .insert({
        order_id: orderId,
        expert_id: expertId ?? null,
        order_amount: orderAmount,
        total_commission: totalCommission,
        expert_payout: expertPayout,
        platform_margin: platformMargin,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to store commission", { orderId, error: error.message });
      throw ApiError.internal("Failed to calculate commission");
    }

    logger.info("Commission calculated", {
      orderId,
      orderAmount,
      expertId: expertId ?? "none",
      totalCommission,
      expertPayout,
      platformMargin,
    });

    return toCommission(data as CommissionRow);
  }

  /**
   * Reverse commission when an order is RETURNED or RTO.
   * Marks the commission as reversed and cancels the expert payout.
   */
  async reverse(orderId: string): Promise<Commission | null> {
    const existing = await this.getByOrderId(orderId);
    if (!existing) {
      logger.warn("No commission found to reverse", { orderId });
      return null;
    }

    if (existing.status === "reversed") {
      logger.info("Commission already reversed", { orderId });
      return existing;
    }

    const { data, error } = await supabaseAdmin
      .from("commissions")
      .update({ status: "reversed", reversed_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to reverse commission", { orderId, error: error.message });
      throw ApiError.internal("Failed to reverse commission");
    }

    logger.info("Commission reversed", { orderId });
    return toCommission(data as CommissionRow);
  }

  /**
   * Get commission for an order
   */
  async getByOrderId(orderId: string): Promise<Commission | null> {
    const { data, error } = await supabaseAdmin
      .from("commissions")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch commission", { orderId, error: error.message });
      throw ApiError.internal("Failed to fetch commission");
    }

    return data ? toCommission(data as CommissionRow) : null;
  }

  /**
   * Get all commissions for a specific expert with pagination.
   */
  async getExpertCommissions(
    expertId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ data: Commission[]; pagination: { page: number; limit: number; total: number }; stats: ExpertStats }> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("commissions")
      .select("*", { count: "exact" })
      .eq("expert_id", expertId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch expert commissions", { expertId, error: error.message });
      throw ApiError.internal("Failed to fetch commissions");
    }

    // Stats: fetch all non-reversed commissions and bucket by status
    const { data: allRows } = await supabaseAdmin
      .from("commissions")
      .select("expert_payout, status")
      .eq("expert_id", expertId)
      .neq("status", "reversed");

    const stats: ExpertStats = { totalEarned: 0, pendingPayout: 0, inWithdrawal: 0, paidOut: 0 };
    for (const row of allRows ?? []) {
      const payout = Number((row as any).expert_payout ?? 0);
      stats.totalEarned += payout;
      if ((row as any).status === "pending") stats.pendingPayout += payout;
      if ((row as any).status === "reserved") stats.inWithdrawal += payout;
      if ((row as any).status === "paid") stats.paidOut += payout;
    }
    stats.totalEarned = round2(stats.totalEarned);
    stats.pendingPayout = round2(stats.pendingPayout);
    stats.inWithdrawal = round2(stats.inWithdrawal);
    stats.paidOut = round2(stats.paidOut);

    return {
      data: (data ?? []).map((r) => toCommission(r as CommissionRow)),
      pagination: { page, limit, total: count ?? 0 },
      stats,
    };
  }

  /**
   * Get all commissions (admin view) with pagination.
   */
  async getAllCommissions(
    options: { page?: number; limit?: number; status?: string; expertId?: string } = {}
  ): Promise<{ data: Commission[]; pagination: { page: number; limit: number; total: number }; platformStats: PlatformStats }> {
    const { page = 1, limit = 20, status, expertId } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("commissions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (expertId) query = query.eq("expert_id", expertId);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch all commissions", { error: error.message });
      throw ApiError.internal("Failed to fetch commissions");
    }

    // Platform stats across all non-reversed commissions
    const { data: allRows } = await supabaseAdmin
      .from("commissions")
      .select("total_commission, expert_payout, platform_margin, status")
      .neq("status", "reversed");

    const platformStats: PlatformStats = {
      totalRevenue: 0,
      totalExpertPayouts: 0,
      totalPlatformMargin: 0,
      pendingPayouts: 0,
      inWithdrawal: 0,
      paidPayouts: 0,
    };
    for (const row of allRows ?? []) {
      platformStats.totalRevenue += Number((row as any).total_commission ?? 0);
      platformStats.totalExpertPayouts += Number((row as any).expert_payout ?? 0);
      platformStats.totalPlatformMargin += Number((row as any).platform_margin ?? 0);
      if ((row as any).status === "pending") platformStats.pendingPayouts += Number((row as any).expert_payout ?? 0);
      if ((row as any).status === "reserved") platformStats.inWithdrawal += Number((row as any).expert_payout ?? 0);
      if ((row as any).status === "paid") platformStats.paidPayouts += Number((row as any).expert_payout ?? 0);
    }
    Object.keys(platformStats).forEach((k) => {
      (platformStats as any)[k] = round2((platformStats as any)[k]);
    });

    return {
      data: (data ?? []).map((r) => toCommission(r as CommissionRow)),
      pagination: { page, limit, total: count ?? 0 },
      platformStats,
    };
  }

  /**
   * Mark a single commission as paid (admin only, for commissions not linked to a withdrawal).
   * Commissions with status 'reserved' must be paid through the withdrawal flow instead.
   */
  async markAsPaid(commissionId: string): Promise<Commission> {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("commissions")
      .select("status")
      .eq("id", commissionId)
      .single();

    if (fetchError || !existing) throw ApiError.notFound("Commission not found");

    if ((existing as any).status === "reserved") {
      throw ApiError.badRequest(
        "This commission is part of a pending withdrawal. Pay it through the Withdrawals tab."
      );
    }

    const { data, error } = await supabaseAdmin
      .from("commissions")
      .update({ status: "paid" })
      .eq("id", commissionId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to mark commission as paid", { commissionId, error: error.message });
      throw ApiError.internal("Failed to update commission");
    }

    return toCommission(data as CommissionRow);
  }

  // ============================================================
  // BANK ACCOUNTS
  // ============================================================

  async saveBankAccount(expertId: string, data: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  }): Promise<BankAccount> {
    // Set existing accounts as non-primary
    await supabaseAdmin.from("expert_bank_accounts").update({ is_primary: false }).eq("expert_id", expertId);

    const { data: row, error } = await supabaseAdmin
      .from("expert_bank_accounts")
      .upsert({
        expert_id: expertId,
        account_holder_name: data.accountHolderName,
        account_number: data.accountNumber,
        ifsc_code: data.ifscCode,
        bank_name: data.bankName,
        upi_id: data.upiId ?? null,
        is_primary: true,
      }, { onConflict: "expert_id,account_number" })
      .select()
      .single();

    if (error) {
      logger.error("Failed to save bank account", { expertId, error: error.message });
      throw ApiError.internal("Failed to save bank account");
    }

    return toBankAccount(row as BankAccountRow);
  }

  async getBankAccounts(expertId: string): Promise<BankAccount[]> {
    const { data, error } = await supabaseAdmin
      .from("expert_bank_accounts")
      .select("*")
      .eq("expert_id", expertId)
      .order("is_primary", { ascending: false });

    if (error) throw ApiError.internal("Failed to fetch bank accounts");
    return (data ?? []).map((r) => toBankAccount(r as BankAccountRow));
  }

  // ============================================================
  // WITHDRAWAL REQUESTS
  // ============================================================

  async requestWithdrawal(expertId: string, data: {
    amount: number;
    bankAccountId: string;
  }): Promise<WithdrawalRequest> {
    if (data.amount < 500) throw ApiError.badRequest("Minimum withdrawal amount is ₹500");

    // Fetch all pending commissions for this expert, oldest first
    const { data: pendingCommissions, error: fetchError } = await supabaseAdmin
      .from("commissions")
      .select("id, expert_payout")
      .eq("expert_id", expertId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchError) throw ApiError.internal("Failed to fetch commissions");

    // Greedily select commissions until their sum covers the requested amount.
    // The actual withdrawal amount equals the sum of selected commissions
    // (may be slightly higher than requested to avoid splitting a commission).
    let accumulated = 0;
    const selectedIds: string[] = [];
    for (const c of pendingCommissions ?? []) {
      if (accumulated >= data.amount) break;
      accumulated = round2(accumulated + Number(c.expert_payout));
      selectedIds.push(c.id);
    }

    if (selectedIds.length === 0 || accumulated < data.amount) {
      throw ApiError.badRequest(`Insufficient balance. Available: ₹${accumulated}`);
    }

    // Check no pending withdrawal already exists
    const { data: existing } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id")
      .eq("expert_id", expertId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) throw ApiError.badRequest("You already have a pending withdrawal request");

    // Create withdrawal for the actual accumulated amount
    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        expert_id: expertId,
        bank_account_id: data.bankAccountId,
        amount: accumulated,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create withdrawal request", { expertId, error: error.message });
      throw ApiError.internal("Failed to create withdrawal request");
    }

    // Reserve the selected commissions so they can't be withdrawn again
    const { error: reserveError } = await supabaseAdmin
      .from("commissions")
      .update({ status: "reserved", withdrawal_request_id: row.id })
      .in("id", selectedIds);

    if (reserveError) {
      // Roll back the withdrawal request we just created
      await supabaseAdmin.from("withdrawal_requests").delete().eq("id", row.id);
      logger.error("Failed to reserve commissions, rolled back withdrawal", { expertId, error: reserveError.message });
      throw ApiError.internal("Failed to create withdrawal request");
    }

    logger.info("Withdrawal requested", { expertId, amount: accumulated, commissionCount: selectedIds.length });
    return toWithdrawalRequest(row as WithdrawalRequestRow);
  }

  async getWithdrawalRequests(
    expertId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: WithdrawalRequest[]; pagination: { page: number; limit: number; total: number } }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*, bank_account:expert_bank_accounts(bank_name, account_number, upi_id)", { count: "exact" })
      .eq("expert_id", expertId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal("Failed to fetch withdrawal requests");

    return {
      data: (data ?? []).map((r) => toWithdrawalRequest(r as WithdrawalRequestRow)),
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  async getAllWithdrawalRequests(
    options: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ data: WithdrawalRequest[]; pagination: { page: number; limit: number; total: number } }> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("withdrawal_requests")
      .select("*, bank_account:expert_bank_accounts(bank_name, account_number, upi_id), expert:profiles!withdrawal_requests_expert_id_fkey(id, full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal("Failed to fetch withdrawal requests");

    return {
      data: (data ?? []).map((r) => toWithdrawalRequest(r as WithdrawalRequestRow)),
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  async processWithdrawal(withdrawalId: string, action: "approved" | "paid" | "rejected", data?: {
    transactionRef?: string;
    rejectionReason?: string;
  }): Promise<WithdrawalRequest> {
    const updates: Record<string, unknown> = { status: action };
    if (action === "approved" || action === "rejected") updates.processed_at = new Date().toISOString();
    if (action === "paid") updates.paid_at = new Date().toISOString();
    if (data?.transactionRef) updates.transaction_ref = data.transactionRef;
    if (data?.rejectionReason) updates.rejection_reason = data.rejectionReason;

    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .update(updates)
      .eq("id", withdrawalId)
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to process withdrawal");

    // Sync commission statuses to match the withdrawal outcome
    if (action === "paid") {
      // Mark all reserved commissions for this withdrawal as paid
      await supabaseAdmin
        .from("commissions")
        .update({ status: "paid" })
        .eq("withdrawal_request_id", withdrawalId);

      logger.info("Commissions marked paid via withdrawal", { withdrawalId });
    } else if (action === "rejected") {
      // Release reserved commissions back to pending so expert can withdraw again
      await supabaseAdmin
        .from("commissions")
        .update({ status: "pending", withdrawal_request_id: null })
        .eq("withdrawal_request_id", withdrawalId);

      logger.info("Commissions released back to pending after withdrawal rejection", { withdrawalId });
    }

    const withdrawal = toWithdrawalRequest(row as WithdrawalRequestRow);

    // Notify the expert about the outcome
    const notifMap: Partial<Record<typeof action, { title: string; message: string }>> = {
      approved: {
        title: "Withdrawal Approved",
        message: `Your withdrawal of ₹${withdrawal.amount.toFixed(2)} has been approved and will be processed shortly.`,
      },
      paid: {
        title: "Withdrawal Paid",
        message: `₹${withdrawal.amount.toFixed(2)} has been transferred to your bank account.${data?.transactionRef ? ` Reference: ${data.transactionRef}` : ""}`,
      },
      rejected: {
        title: "Withdrawal Rejected",
        message: `Your withdrawal of ₹${withdrawal.amount.toFixed(2)} was rejected.${data?.rejectionReason ? ` Reason: ${data.rejectionReason}` : ""} Your balance has been restored.`,
      },
    };
    const notif = notifMap[action];
    if (notif) {
      notificationService.create(withdrawal.expertId, `withdrawal.${action}`, notif.title, notif.message, { withdrawalId }).catch(() => {});
    }

    return withdrawal;
  }
}

// ============================================================
// Additional types
// ============================================================

export interface ExpertStats {
  totalEarned: number;
  pendingPayout: number;
  inWithdrawal: number;
  paidOut: number;
}

export interface PlatformStats {
  totalRevenue: number;
  totalExpertPayouts: number;
  totalPlatformMargin: number;
  pendingPayouts: number;
  inWithdrawal: number;
  paidPayouts: number;
}

export interface BankAccountRow {
  id: string;
  expert_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  upi_id: string | null;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  expertId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string | null;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: string;
}

function toBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    expertId: row.expert_id,
    accountHolderName: row.account_holder_name,
    accountNumber: row.account_number,
    ifscCode: row.ifsc_code,
    bankName: row.bank_name,
    upiId: row.upi_id,
    isVerified: row.is_verified,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

export interface WithdrawalRequestRow {
  id: string;
  expert_id: string;
  bank_account_id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  rejection_reason: string | null;
  requested_at: string;
  processed_at: string | null;
  paid_at: string | null;
  transaction_ref: string | null;
  created_at: string;
  updated_at: string;
  bank_account?: { bank_name: string; account_number: string; upi_id: string | null };
  expert?: { id: string; full_name: string | null; email: string };
}

export interface WithdrawalRequest {
  id: string;
  expertId: string;
  bankAccountId: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  paidAt: string | null;
  transactionRef: string | null;
  createdAt: string;
  bankAccount?: { bankName: string; accountNumber: string; upiId: string | null };
  expert?: { id: string; fullName: string | null; email: string };
}

function toWithdrawalRequest(row: WithdrawalRequestRow): WithdrawalRequest {
  return {
    id: row.id,
    expertId: row.expert_id,
    bankAccountId: row.bank_account_id,
    amount: Number(row.amount),
    status: row.status,
    rejectionReason: row.rejection_reason,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    paidAt: row.paid_at,
    transactionRef: row.transaction_ref,
    createdAt: row.created_at,
    bankAccount: row.bank_account ? {
      bankName: row.bank_account.bank_name,
      accountNumber: row.bank_account.account_number,
      upiId: row.bank_account.upi_id,
    } : undefined,
    expert: row.expert ? {
      id: row.expert.id,
      fullName: row.expert.full_name,
      email: row.expert.email,
    } : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const commissionService = new CommissionService();
