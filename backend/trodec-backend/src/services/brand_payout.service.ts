import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { notificationService } from "./notification.service";
import { shiprocketClient } from "./logistics.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandPayoutRow {
  id: string;
  order_id: string;
  brand_id: string;
  order_amount: number;
  shipping_cost: number;
  platform_commission: number;
  brand_net: number;
  status: "pending" | "reserved" | "paid" | "reversed";
  reversed_at: string | null;
  withdrawal_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandPayout {
  id: string;
  orderId: string;
  brandId: string;
  orderAmount: number;
  shippingCost: number;
  platformCommission: number;
  brandNet: number;
  status: "pending" | "reserved" | "paid" | "reversed";
  reversedAt: string | null;
  withdrawalRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toBrandPayout(row: BrandPayoutRow): BrandPayout {
  return {
    id: row.id,
    orderId: row.order_id,
    brandId: row.brand_id,
    orderAmount: Number(row.order_amount),
    shippingCost: Number(row.shipping_cost),
    platformCommission: Number(row.platform_commission),
    brandNet: Number(row.brand_net),
    status: row.status,
    reversedAt: row.reversed_at,
    withdrawalRequestId: row.withdrawal_request_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface BrandBankAccountRow {
  id: string;
  brand_id: string;
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

export interface BrandBankAccount {
  id: string;
  brandId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string | null;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: string;
}

function toBrandBankAccount(row: BrandBankAccountRow): BrandBankAccount {
  return {
    id: row.id,
    brandId: row.brand_id,
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

export interface BrandWithdrawalRequestRow {
  id: string;
  brand_id: string;
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
  brand?: { id: string; full_name: string | null; email: string };
}

export interface BrandWithdrawalRequest {
  id: string;
  brandId: string;
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
  brand?: { id: string; fullName: string | null; email: string };
}

function toBrandWithdrawalRequest(row: BrandWithdrawalRequestRow): BrandWithdrawalRequest {
  return {
    id: row.id,
    brandId: row.brand_id,
    bankAccountId: row.bank_account_id,
    amount: Number(row.amount),
    status: row.status,
    rejectionReason: row.rejection_reason,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    paidAt: row.paid_at,
    transactionRef: row.transaction_ref,
    createdAt: row.created_at,
    bankAccount: row.bank_account
      ? { bankName: row.bank_account.bank_name, accountNumber: row.bank_account.account_number, upiId: row.bank_account.upi_id }
      : undefined,
    brand: row.brand
      ? { id: row.brand.id, fullName: row.brand.full_name, email: row.brand.email }
      : undefined,
  };
}

export interface BrandEarningsStats {
  totalEarned: number;
  pendingPayout: number;
  inWithdrawal: number;
  paidOut: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BrandPayoutService {
  /**
   * Calculate and persist per-brand net payouts when an order is DELIVERED.
   *
   * Handles multi-brand orders: creates one row per unique brand in order_items,
   * splitting shipping cost and platform commission proportionally by each
   * brand's share of the order subtotal.
   *
   * formula per brand:
   *   brand_share    = brand_subtotal / order_subtotal
   *   brand_shipping = actual_shipping_cost × brand_share
   *   brand_commission = platform_commission × brand_share
   *   brand_net      = brand_subtotal - brand_shipping - brand_commission
   *
   * Idempotent — skips brands that already have a payout row for this order.
   *
   * Fix #3 (zero shipping): if actual_shipping_cost is 0 and a shipment exists,
   * falls back to the Shiprocket serviceability API to look up the real freight.
   */
  async calculateAndStore(orderId: string): Promise<BrandPayout[]> {
    // Fetch order
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, subtotal, actual_shipping_cost, shipping_postal_code")
      .eq("id", orderId)
      .single();

    if (orderErr || !orderRow) throw ApiError.notFound("Order not found for brand payout");

    const orderSubtotal = Number((orderRow as any).subtotal ?? 0);
    let shippingCost    = Number((orderRow as any).actual_shipping_cost ?? 0);

    // Fix #3: if actual_shipping_cost was never stored (Shiprocket failed at order creation),
    // try to resolve it now via the serviceability API using the shipment's pickup location.
    if (shippingCost === 0) {
      shippingCost = await this.resolveShippingCost(orderId, (orderRow as any).shipping_postal_code ?? "");
      if (shippingCost > 0) {
        await supabaseAdmin
          .from("orders")
          .update({ actual_shipping_cost: shippingCost })
          .eq("id", orderId);
        logger.info("Shipping cost resolved at payout time", { orderId, shippingCost });
      }
    }

    // Platform commission (guaranteed to exist — commissionService ran before us)
    const { data: commRow } = await supabaseAdmin
      .from("commissions")
      .select("total_commission")
      .eq("order_id", orderId)
      .maybeSingle();

    const platformCommission = Number((commRow as any)?.total_commission ?? 0);

    // Fix #4: group order items by brand to support multi-brand orders
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("brand_id, subtotal")
      .eq("order_id", orderId);

    if (!items || items.length === 0) throw ApiError.notFound("No order items found");

    // Aggregate subtotal per brand
    const brandSubtotals: Record<string, number> = {};
    for (const item of items) {
      const bid = (item as any).brand_id as string;
      brandSubtotals[bid] = round2((brandSubtotals[bid] ?? 0) + Number((item as any).subtotal ?? 0));
    }

    // Create one payout row per brand (skip if already exists for this order+brand)
    const results: BrandPayout[] = [];

    for (const [brandId, brandSubtotal] of Object.entries(brandSubtotals)) {
      // Idempotency: skip if payout already exists for this (order_id, brand_id) pair
      const { data: existing } = await supabaseAdmin
        .from("brand_payouts")
        .select("id")
        .eq("order_id", orderId)
        .eq("brand_id", brandId)
        .maybeSingle();

      if (existing) {
        logger.info("Brand payout already exists, skipping", { orderId, brandId });
        continue;
      }

      // Proportional split of shared costs
      const share            = orderSubtotal > 0 ? brandSubtotal / orderSubtotal : 1;
      const brandShipping    = round2(shippingCost * share);
      const brandCommission  = round2(platformCommission * share);
      const brandNet         = round2(brandSubtotal - brandShipping - brandCommission);

      const { data, error } = await supabaseAdmin
        .from("brand_payouts")
        .insert({
          order_id:            orderId,
          brand_id:            brandId,
          order_amount:        brandSubtotal,
          shipping_cost:       brandShipping,
          platform_commission: brandCommission,
          brand_net:           brandNet,
          status:              "pending",
        })
        .select()
        .single();

      if (error) {
        logger.error("Failed to store brand payout", { orderId, brandId, error: error.message });
        throw ApiError.internal("Failed to calculate brand payout");
      }

      logger.info("Brand payout calculated", { orderId, brandId, brandSubtotal, brandShipping, brandCommission, brandNet });

      notificationService
        .create(
          brandId,
          "payout.available",
          "Payout Available",
          `Order delivered! ₹${brandNet.toFixed(2)} is available for withdrawal.`,
          { orderId }
        )
        .catch(() => {});

      results.push(toBrandPayout(data as BrandPayoutRow));
    }

    return results;
  }

  /**
   * Fix #3 helper — attempt to resolve shipping cost via Shiprocket serviceability API.
   * Returns 0 if unavailable.
   */
  private async resolveShippingCost(orderId: string, deliveryPincode: string): Promise<number> {
    if (!deliveryPincode) return 0;
    try {
      const { data: shipmentRow } = await supabaseAdmin
        .from("shipments")
        .select("shiprocket_shipment_id, from_address, awb_code")
        .eq("order_id", orderId)
        .eq("type", "FORWARD")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!shipmentRow) return 0;

      const fromAddr = (shipmentRow as any).from_address as Record<string, string> | null;
      const pickupPincode = fromAddr?.postalCode ?? fromAddr?.postal_code ?? "";
      if (!pickupPincode) return 0;

      const freight = await shiprocketClient.getFreightCharge({
        pickupPincode,
        deliveryPincode,
        weight: 0.5,
      });
      return freight ?? 0;
    } catch (err) {
      logger.warn("Shipping cost fallback lookup failed at payout time", { orderId, err });
      return 0;
    }
  }

  /** Returns all payout rows for an order (one per brand). */
  async getByOrderId(orderId: string): Promise<BrandPayout[]> {
    const { data, error } = await supabaseAdmin
      .from("brand_payouts")
      .select("*")
      .eq("order_id", orderId);

    if (error) throw ApiError.internal("Failed to fetch brand payouts");
    return (data ?? []).map((r) => toBrandPayout(r as BrandPayoutRow));
  }

  /** Reverses all payout rows for an order (e.g. on cancellation). */
  async reverse(orderId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("brand_payouts")
      .update({ status: "reversed", reversed_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .neq("status", "reversed");

    if (error) throw ApiError.internal("Failed to reverse brand payouts");
    logger.info("Brand payouts reversed", { orderId });
  }

  // ============================================================
  // Brand payouts list + stats
  // ============================================================

  async getBrandPayouts(
    brandId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{
    data: BrandPayout[];
    pagination: { page: number; limit: number; total: number };
    stats: BrandEarningsStats;
  }> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("brand_payouts")
      .select("*", { count: "exact" })
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal("Failed to fetch brand payouts");

    // Stats across all non-reversed payouts
    const { data: allRows } = await supabaseAdmin
      .from("brand_payouts")
      .select("brand_net, status")
      .eq("brand_id", brandId)
      .neq("status", "reversed");

    const stats: BrandEarningsStats = { totalEarned: 0, pendingPayout: 0, inWithdrawal: 0, paidOut: 0 };
    for (const row of allRows ?? []) {
      const net = Number((row as any).brand_net ?? 0);
      stats.totalEarned += net;
      if ((row as any).status === "pending")  stats.pendingPayout += net;
      if ((row as any).status === "reserved") stats.inWithdrawal  += net;
      if ((row as any).status === "paid")     stats.paidOut       += net;
    }
    stats.totalEarned   = round2(stats.totalEarned);
    stats.pendingPayout = round2(stats.pendingPayout);
    stats.inWithdrawal  = round2(stats.inWithdrawal);
    stats.paidOut       = round2(stats.paidOut);

    return {
      data: (data ?? []).map((r) => toBrandPayout(r as BrandPayoutRow)),
      pagination: { page, limit, total: count ?? 0 },
      stats,
    };
  }

  // ============================================================
  // Bank accounts
  // ============================================================

  async saveBankAccount(brandId: string, data: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  }): Promise<BrandBankAccount> {
    await supabaseAdmin.from("brand_bank_accounts").update({ is_primary: false }).eq("brand_id", brandId);

    const { data: row, error } = await supabaseAdmin
      .from("brand_bank_accounts")
      .upsert({
        brand_id:             brandId,
        account_holder_name:  data.accountHolderName,
        account_number:       data.accountNumber,
        ifsc_code:            data.ifscCode,
        bank_name:            data.bankName,
        upi_id:               data.upiId ?? null,
        is_primary:           true,
      }, { onConflict: "brand_id,account_number" })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to save bank account");
    return toBrandBankAccount(row as BrandBankAccountRow);
  }

  async getBankAccounts(brandId: string): Promise<BrandBankAccount[]> {
    const { data, error } = await supabaseAdmin
      .from("brand_bank_accounts")
      .select("*")
      .eq("brand_id", brandId)
      .order("is_primary", { ascending: false });

    if (error) throw ApiError.internal("Failed to fetch bank accounts");
    return (data ?? []).map((r) => toBrandBankAccount(r as BrandBankAccountRow));
  }

  // ============================================================
  // Withdrawal requests
  // ============================================================

  async requestWithdrawal(brandId: string, data: {
    amount: number;
    bankAccountId: string;
  }): Promise<BrandWithdrawalRequest> {
    if (data.amount < 100) throw ApiError.badRequest("Minimum withdrawal amount is ₹100");

    const { data: pendingPayouts, error: fetchError } = await supabaseAdmin
      .from("brand_payouts")
      .select("id, brand_net")
      .eq("brand_id", brandId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchError) throw ApiError.internal("Failed to fetch payouts");

    let accumulated = 0;
    const selectedIds: string[] = [];
    for (const p of pendingPayouts ?? []) {
      if (accumulated >= data.amount) break;
      accumulated = round2(accumulated + Number(p.brand_net));
      selectedIds.push(p.id);
    }

    if (selectedIds.length === 0 || accumulated < data.amount) {
      throw ApiError.badRequest(`Insufficient balance. Available: ₹${accumulated}`);
    }

    const { data: existing } = await supabaseAdmin
      .from("brand_withdrawal_requests")
      .select("id")
      .eq("brand_id", brandId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) throw ApiError.badRequest("You already have a pending withdrawal request");

    const { data: row, error } = await supabaseAdmin
      .from("brand_withdrawal_requests")
      .insert({
        brand_id:        brandId,
        bank_account_id: data.bankAccountId,
        amount:          accumulated,
        status:          "pending",
      })
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to create withdrawal request");

    const { error: reserveError } = await supabaseAdmin
      .from("brand_payouts")
      .update({ status: "reserved", withdrawal_request_id: row.id })
      .in("id", selectedIds);

    if (reserveError) {
      await supabaseAdmin.from("brand_withdrawal_requests").delete().eq("id", row.id);
      throw ApiError.internal("Failed to reserve payouts for withdrawal");
    }

    logger.info("Brand withdrawal requested", { brandId, amount: accumulated });
    return toBrandWithdrawalRequest(row as BrandWithdrawalRequestRow);
  }

  async getWithdrawalRequests(
    brandId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ data: BrandWithdrawalRequest[]; pagination: { page: number; limit: number; total: number } }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from("brand_withdrawal_requests")
      .select("*, bank_account:brand_bank_accounts(bank_name, account_number, upi_id)", { count: "exact" })
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw ApiError.internal("Failed to fetch withdrawal requests");

    return {
      data: (data ?? []).map((r) => toBrandWithdrawalRequest(r as BrandWithdrawalRequestRow)),
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  async getAllWithdrawalRequests(
    options: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ data: BrandWithdrawalRequest[]; pagination: { page: number; limit: number; total: number } }> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("brand_withdrawal_requests")
      .select(
        "*, bank_account:brand_bank_accounts(bank_name, account_number, upi_id), brand:profiles!brand_withdrawal_requests_brand_id_fkey(id, full_name, email)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal("Failed to fetch withdrawal requests");

    return {
      data: (data ?? []).map((r) => toBrandWithdrawalRequest(r as BrandWithdrawalRequestRow)),
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  async processWithdrawal(
    withdrawalId: string,
    action: "approved" | "paid" | "rejected",
    data?: { transactionRef?: string; rejectionReason?: string }
  ): Promise<BrandWithdrawalRequest> {
    const updates: Record<string, unknown> = { status: action };
    if (action === "approved" || action === "rejected") updates.processed_at = new Date().toISOString();
    if (action === "paid")                              updates.paid_at       = new Date().toISOString();
    if (data?.transactionRef)  updates.transaction_ref  = data.transactionRef;
    if (data?.rejectionReason) updates.rejection_reason = data.rejectionReason;

    const { data: row, error } = await supabaseAdmin
      .from("brand_withdrawal_requests")
      .update(updates)
      .eq("id", withdrawalId)
      .select()
      .single();

    if (error) throw ApiError.internal("Failed to process withdrawal");

    if (action === "paid") {
      await supabaseAdmin
        .from("brand_payouts")
        .update({ status: "paid" })
        .eq("withdrawal_request_id", withdrawalId);
    } else if (action === "rejected") {
      await supabaseAdmin
        .from("brand_payouts")
        .update({ status: "pending", withdrawal_request_id: null })
        .eq("withdrawal_request_id", withdrawalId);
    }

    const withdrawal = toBrandWithdrawalRequest(row as BrandWithdrawalRequestRow);

    const notifMap: Partial<Record<typeof action, { title: string; message: string }>> = {
      approved: { title: "Withdrawal Approved", message: `Your withdrawal of ₹${withdrawal.amount.toFixed(2)} has been approved.` },
      paid:     { title: "Withdrawal Paid",     message: `₹${withdrawal.amount.toFixed(2)} has been transferred to your bank account.${data?.transactionRef ? ` Ref: ${data.transactionRef}` : ""}` },
      rejected: { title: "Withdrawal Rejected", message: `Your withdrawal of ₹${withdrawal.amount.toFixed(2)} was rejected.${data?.rejectionReason ? ` Reason: ${data.rejectionReason}` : ""}` },
    };
    const notif = notifMap[action];
    if (notif) {
      notificationService
        .create(withdrawal.brandId, `withdrawal.${action}`, notif.title, notif.message, { withdrawalId })
        .catch(() => {});
    }

    return withdrawal;
  }
}

export const brandPayoutService = new BrandPayoutService();
