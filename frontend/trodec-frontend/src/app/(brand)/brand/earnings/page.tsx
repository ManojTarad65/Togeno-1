"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Wallet, TrendingUp, Clock, BadgeCheck, AlertCircle, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import {
  getBrandEarnings,
  getBrandBankAccounts,
  saveBrandBankAccount,
  getBrandWithdrawals,
  requestBrandWithdrawal,
  BrandPayout,
  BrandEarningsStats,
  BrandBankAccount,
  BrandWithdrawalRequest,
} from "@/services/brand.service";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  reserved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  reversed: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  approved: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        <p className="text-xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

export default function BrandEarningsPage() {
  const [stats, setStats] = useState<BrandEarningsStats | null>(null);
  const [payouts, setPayouts] = useState<BrandPayout[]>([]);
  const [withdrawals, setWithdrawals] = useState<BrandWithdrawalRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BrandBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"payouts" | "withdrawals">("payouts");

  // Withdrawal modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bank account modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [earningsRes, withdrawalsRes, accountsRes] = await Promise.all([
        getBrandEarnings({ limit: 50 }),
        getBrandWithdrawals({ limit: 20 }),
        getBrandBankAccounts(),
      ]);
      setStats(earningsRes.stats);
      setPayouts(earningsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setBankAccounts(accountsRes);
      if (accountsRes.length > 0) setSelectedBankId(accountsRes[0].id);
    } catch {
      toast.error("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleRequestWithdrawal() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 100) { toast.error("Minimum withdrawal is ₹100"); return; }
    if (!selectedBankId) { toast.error("Please select a bank account"); return; }
    try {
      setSubmitting(true);
      await requestBrandWithdrawal({ amount, bankAccountId: selectedBankId });
      toast.success("Withdrawal request submitted");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit withdrawal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveBankAccount() {
    const { accountHolderName, accountNumber, ifscCode, bankName } = bankForm;
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      toast.error("Please fill all required fields"); return;
    }
    try {
      setSavingBank(true);
      const saved = await saveBrandBankAccount(bankForm);
      setBankAccounts((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);
      setSelectedBankId(saved.id);
      setShowBankModal(false);
      setBankForm({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "" });
      toast.success("Bank account saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save bank account");
    } finally {
      setSavingBank(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 text-white">
      {/* Header */}
      <div className="pb-6 border-b border-[#1f1f1f] flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Your net payout per order = item price − shipping cost − platform commission
          </p>
        </div>
        <button
          onClick={() => setShowWithdrawModal(true)}
          disabled={(stats?.pendingPayout ?? 0) < 100}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Earned" value={fmt(stats.totalEarned)}   icon={<TrendingUp className="w-4 h-4" />} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard label="Available"    value={fmt(stats.pendingPayout)} icon={<Wallet className="w-4 h-4" />}     color="bg-amber-500/10 text-amber-400" />
          <StatCard label="In Withdrawal" value={fmt(stats.inWithdrawal)} icon={<Clock className="w-4 h-4" />}      color="bg-blue-500/10 text-blue-400" />
          <StatCard label="Paid Out"     value={fmt(stats.paidOut)}       icon={<BadgeCheck className="w-4 h-4" />} color="bg-purple-500/10 text-purple-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1f1f1f]">
        {(["payouts", "withdrawals"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "text-white border-b-2 border-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Payouts table */}
      {tab === "payouts" && (
        payouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <Wallet className="h-8 w-8 mb-3" />
            <p className="text-sm">No payouts yet. Earnings appear after orders are delivered.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#1f1f1f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#0b0b0b]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Order</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Item Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Shipping</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Commission</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400">Your Net</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{p.orderId.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{fmt(p.orderAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-400">−{fmt(p.shippingCost)}</td>
                    <td className="px-4 py-3 text-right text-red-400">−{fmt(p.platformCommission)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(p.brandNet)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[p.status] ?? ""}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Withdrawals table */}
      {tab === "withdrawals" && (
        withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
            <Clock className="h-8 w-8 mb-3" />
            <p className="text-sm">No withdrawal requests yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#1f1f1f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#0b0b0b]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Bank</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Requested</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Ref</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{fmt(w.amount)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {w.bankAccount ? `${w.bankAccount.bankName} ···${w.bankAccount.accountNumber.slice(-4)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[w.status] ?? ""}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(w.requestedAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono">{w.transactionRef ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Bank accounts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Bank Accounts</h2>
          <button
            onClick={() => setShowBankModal(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add account
          </button>
        </div>
        {bankAccounts.length === 0 ? (
          <p className="text-xs text-zinc-600">No bank account added yet. Add one to request withdrawals.</p>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-[#111111] border border-[#1f1f1f] rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm text-white font-medium">{a.bankName}</p>
                  <p className="text-xs text-zinc-500">{a.accountHolderName} · ···{a.accountNumber.slice(-4)} · IFSC: {a.ifscCode}</p>
                </div>
                {a.isPrimary && (
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Request Withdrawal</h3>
            <div className="bg-[#0b0b0b] rounded-lg p-3 text-sm text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Available balance</span>
                <span className="text-white font-semibold">{fmt(stats?.pendingPayout ?? 0)}</span>
              </div>
              <p className="text-xs text-zinc-600">Minimum withdrawal: ₹100</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  min="100"
                  max={stats?.pendingPayout ?? 0}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Bank Account</label>
                {bankAccounts.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Add a bank account first
                  </div>
                ) : (
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} · ···{a.accountNumber.slice(-4)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowWithdrawModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleRequestWithdrawal}
                disabled={submitting || bankAccounts.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Add Bank Account</h3>
            {[
              { key: "accountHolderName", label: "Account Holder Name *", placeholder: "Full name as per bank" },
              { key: "accountNumber", label: "Account Number *", placeholder: "Your account number" },
              { key: "ifscCode", label: "IFSC Code *", placeholder: "e.g. HDFC0001234" },
              { key: "bankName", label: "Bank Name *", placeholder: "e.g. HDFC Bank" },
              { key: "upiId", label: "UPI ID (optional)", placeholder: "name@upi" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
                <input
                  value={(bankForm as any)[key]}
                  onChange={(e) => setBankForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-[#0b0b0b] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowBankModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleSaveBankAccount}
                disabled={savingBank}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {savingBank && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
