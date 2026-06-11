import api, { ApiSuccessResponse, getErrorMessage } from './api';

export interface Commission {
  id: string;
  orderId: string;
  expertId: string | null;
  orderAmount: number;
  totalCommission: number;
  expertPayout: number;
  platformMargin: number;
  status: 'pending' | 'reserved' | 'paid' | 'reversed';
  reversedAt: string | null;
  withdrawalRequestId: string | null;
  createdAt: string;
}

export interface ExpertStats {
  totalEarned: number;
  pendingPayout: number;
  inWithdrawal: number;
  paidOut: number;
  totalOrders: number;
  avgPerOrder: number;
}

export interface PlatformStats {
  totalRevenue: number;
  totalExpertPayouts: number;
  totalPlatformMargin: number;
  pendingPayouts: number;
  inWithdrawal: number;
  paidPayouts: number;
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

export interface WithdrawalRequest {
  id: string;
  expertId: string;
  bankAccountId: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  paidAt: string | null;
  transactionRef: string | null;
  createdAt: string;
  bankAccount?: { bankName: string; accountNumber: string; upiId: string | null };
  expert?: { id: string; fullName: string | null; email: string };
}

interface Paginated<T> { data: T[]; pagination: { page: number; limit: number; total: number } }

// ── Expert ────────────────────────────────────────────────────────────────────

export async function getMyCommissions(params?: { page?: number; limit?: number; status?: string }): Promise<Paginated<Commission> & { stats: ExpertStats }> {
  try {
    const res = await api.get<ApiSuccessResponse<any>>('/commissions/me', { params });
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function getMyStats(): Promise<ExpertStats> {
  try {
    const res = await api.get<ApiSuccessResponse<ExpertStats>>('/commissions/me/stats');
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  try {
    const res = await api.get<ApiSuccessResponse<BankAccount[]>>('/commissions/me/bank-accounts');
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function saveBankAccount(data: {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId?: string;
}): Promise<BankAccount> {
  try {
    const res = await api.post<ApiSuccessResponse<BankAccount>>('/commissions/me/bank-accounts', data);
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function getMyWithdrawals(params?: { page?: number; limit?: number }): Promise<Paginated<WithdrawalRequest>> {
  try {
    const res = await api.get<ApiSuccessResponse<Paginated<WithdrawalRequest>>>('/commissions/me/withdrawals', { params });
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function requestWithdrawal(data: { amount: number; bankAccountId: string }): Promise<WithdrawalRequest> {
  try {
    const res = await api.post<ApiSuccessResponse<WithdrawalRequest>>('/commissions/me/withdrawals', data);
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAllCommissions(params?: { page?: number; limit?: number; status?: string; expertId?: string }): Promise<Paginated<Commission> & { platformStats: PlatformStats }> {
  try {
    const res = await api.get<ApiSuccessResponse<any>>('/commissions', { params });
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function markCommissionPaid(id: string): Promise<Commission> {
  try {
    const res = await api.patch<ApiSuccessResponse<Commission>>(`/commissions/${id}/mark-paid`);
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function getAllWithdrawals(params?: { page?: number; limit?: number; status?: string }): Promise<Paginated<WithdrawalRequest>> {
  try {
    const res = await api.get<ApiSuccessResponse<Paginated<WithdrawalRequest>>>('/commissions/withdrawals', { params });
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}

export async function processWithdrawal(id: string, action: 'approved' | 'paid' | 'rejected', data?: { transactionRef?: string; rejectionReason?: string }): Promise<WithdrawalRequest> {
  try {
    const res = await api.patch<ApiSuccessResponse<WithdrawalRequest>>(`/commissions/withdrawals/${id}`, { action, ...data });
    return res.data.data;
  } catch (e) { throw new Error(getErrorMessage(e)); }
}
