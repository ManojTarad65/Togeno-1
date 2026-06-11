"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, Clock, CheckCircle, Banknote, Plus, ArrowDownToLine, Hourglass, ShoppingBag, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getMyCommissions, getMyStats, getBankAccounts, saveBankAccount,
  getMyWithdrawals, requestWithdrawal,
  ExpertStats, Commission, BankAccount, WithdrawalRequest,
} from "@/services/commission.service";

const statusColor: Record<string, string> = {
  pending: "border-yellow-500/30 text-yellow-400",
  reserved: "border-blue-500/30 text-blue-400",
  paid: "border-emerald-500/30 text-emerald-400",
  reversed: "border-red-500/30 text-red-400",
};

const withdrawalColor: Record<string, string> = {
  pending: "border-yellow-500/30 text-yellow-400",
  approved: "border-blue-500/30 text-blue-400",
  paid: "border-emerald-500/30 text-emerald-400",
  rejected: "border-red-500/30 text-red-400",
};

export default function ExpertEarningsPage() {
  const [stats, setStats] = useState<ExpertStats | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"earnings" | "withdrawals" | "bank">("earnings");

  // Bank form
  const [bankForm, setBankForm] = useState({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "" });
  const [savingBank, setSavingBank] = useState(false);

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [commissionsRes, withdrawalsRes, accountsRes] = await Promise.all([
        getMyCommissions({ limit: 50 }),
        getMyWithdrawals({ limit: 50 }),
        getBankAccounts(),
      ]);
      setStats(commissionsRes.stats);
      setCommissions(commissionsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setBankAccounts(accountsRes);
      if (accountsRes.length > 0) setSelectedBankId(accountsRes.find(a => a.isPrimary)?.id ?? accountsRes[0].id);
    } catch (e: any) {
      toast.error(e.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingBank(true);
      const account = await saveBankAccount(bankForm);
      setBankAccounts(prev => [account, ...prev.filter(a => a.id !== account.id)]);
      setSelectedBankId(account.id);
      toast.success("Bank account saved");
      setBankForm({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", upiId: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save bank account");
    } finally {
      setSavingBank(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBankId) { toast.error("Please add a bank account first"); return; }
    try {
      setRequesting(true);
      const wr = await requestWithdrawal({ amount: Number(withdrawAmount), bankAccountId: selectedBankId });
      setWithdrawals(prev => [wr, ...prev]);
      setWithdrawAmount("");
      toast.success("Withdrawal request submitted");
      setActiveTab("withdrawals");
    } catch (e: any) {
      toast.error(e.message || "Failed to request withdrawal");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-8 text-white max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Earnings</h1>
        <p className="text-zinc-500 mt-1">Your commission earnings from product reviews</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xs text-zinc-500">Total Earned</p>
            <p className="text-xl font-bold">₹{stats?.totalEarned.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-xs text-zinc-500">Available</p>
            <p className="text-xl font-bold">₹{stats?.pendingPayout.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Hourglass className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xs text-zinc-500">In Withdrawal</p>
            <p className="text-xl font-bold">₹{stats?.inWithdrawal.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xs text-zinc-500">Paid Out</p>
            <p className="text-xl font-bold">₹{stats?.paidOut.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xs text-zinc-500">Total Orders</p>
            <p className="text-xl font-bold">{stats?.totalOrders ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="p-5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-pink-500" />
            </div>
            <p className="text-xs text-zinc-500">Avg / Order</p>
            <p className="text-xl font-bold">₹{stats?.avgPerOrder.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0b0b0b] border border-[#1a1a1a] rounded-xl p-1 w-fit">
        {(["earnings", "withdrawals", "bank"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>
            {tab === "bank" ? "Bank Account" : tab}
          </button>
        ))}
      </div>

      {/* Earnings tab */}
      {activeTab === "earnings" && (
        <div className="space-y-4">
          {/* Withdraw CTA */}
          {(stats?.pendingPayout ?? 0) >= 500 && (
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-emerald-400">₹{stats?.pendingPayout.toFixed(2)} available for withdrawal</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Minimum withdrawal: ₹500</p>
                </div>
                <Button onClick={() => { setWithdrawAmount(String(stats?.pendingPayout ?? "")); setActiveTab("withdrawals"); }} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                  <ArrowDownToLine className="w-4 h-4" /> Withdraw
                </Button>
              </CardContent>
            </Card>
          )}

          {commissions.length === 0 ? (
            <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
              <CardContent className="py-16 text-center text-zinc-500">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
                <p>No earnings yet. Start posting reviews to earn commissions.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {commissions.map(c => (
                <Card key={c.id} className="bg-[#0b0b0b] border-[#1a1a1a]">
                  <CardContent className="p-4 space-y-3">
                    {/* Top row: product + badge */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {(c as any).productName ?? `Order #${((c as any).orderNumber ?? c.orderId.slice(0, 8)).toUpperCase()}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(c as any).orderNumber && (
                            <span className="text-xs text-zinc-500">#{(c as any).orderNumber}</span>
                          )}
                          {(c as any).communityName && (
                            <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" />{(c as any).communityName}
                            </span>
                          )}
                          <span className="text-xs text-zinc-600">{new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`capitalize shrink-0 ${statusColor[c.status]}`}>{c.status === "reserved" ? "in withdrawal" : c.status}</Badge>
                    </div>

                    {/* Commission breakdown */}
                    <div className="grid grid-cols-3 gap-2 bg-white/2 border border-white/5 rounded-lg p-3">
                      <div className="text-center">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Order Total</p>
                        <p className="text-sm font-semibold text-zinc-300">₹{Number(c.orderAmount).toFixed(2)}</p>
                      </div>
                      <div className="text-center border-x border-white/5">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Platform Take</p>
                        <p className="text-sm font-semibold text-zinc-400">₹{Number(c.platformMargin).toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Your Cut</p>
                        <p className="text-sm font-bold text-emerald-400">+₹{Number(c.expertPayout).toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Withdrawals tab */}
      {activeTab === "withdrawals" && (
        <div className="space-y-6">
          {/* Request form */}
          <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-emerald-500" /> Request Withdrawal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {bankAccounts.length === 0 ? (
                <div className="text-center py-6 text-zinc-500">
                  <Banknote className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-sm">Add a bank account first before requesting a withdrawal.</p>
                  <Button onClick={() => setActiveTab("bank")} variant="outline" className="mt-3 border-zinc-700 text-xs">
                    Add Bank Account
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <select value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)}
                      className="w-full bg-[#111] border border-zinc-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      {bankAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.bankName} — ••••{a.accountNumber.slice(-4)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹)</Label>
                    <Input type="number" min={500} max={stats?.pendingPayout ?? 0} placeholder="Min ₹500"
                      value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                      className="bg-[#111] border-zinc-700 text-white" />
                    <p className="text-xs text-zinc-500">Available: ₹{stats?.pendingPayout.toFixed(2) ?? "0.00"} · Minimum ₹500 · Actual payout rounds up to cover whole commissions</p>
                  </div>
                  <Button type="submit" disabled={requesting || !withdrawAmount || Number(withdrawAmount) < 500}
                    className="bg-white text-black hover:bg-zinc-200 w-full">
                    {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal history */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white">Withdrawal History</h3>
            {withdrawals.length === 0 ? (
              <p className="text-zinc-500 text-sm">No withdrawal requests yet.</p>
            ) : (
              withdrawals.map(w => (
                <Card key={w.id} className="bg-[#0b0b0b] border-[#1a1a1a]">
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">₹{Number(w.amount).toFixed(2)}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {w.bankAccount ? `${w.bankAccount.bankName} ••••${w.bankAccount.accountNumber.slice(-4)}` : ""}
                        · {new Date(w.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {w.rejectionReason && <p className="text-xs text-red-400 mt-1">{w.rejectionReason}</p>}
                      {w.transactionRef && <p className="text-xs text-zinc-400 mt-1">Ref: {w.transactionRef}</p>}
                    </div>
                    <Badge variant="outline" className={`capitalize ${withdrawalColor[w.status]}`}>{w.status}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bank Account tab */}
      {activeTab === "bank" && (
        <div className="space-y-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-500" /> {bankAccounts.length > 0 ? "Update Bank Account" : "Add Bank Account"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveBank} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Holder Name *</Label>
                    <Input value={bankForm.accountHolderName} onChange={e => setBankForm(f => ({ ...f, accountHolderName: e.target.value }))}
                      placeholder="Full name as per bank" className="bg-[#111] border-zinc-700 text-white" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Input value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))}
                      placeholder="e.g. HDFC Bank" className="bg-[#111] border-zinc-700 text-white" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number *</Label>
                    <Input value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))}
                      placeholder="Account number" className="bg-[#111] border-zinc-700 text-white" required />
                  </div>
                  <div className="space-y-2">
                    <Label>IFSC Code *</Label>
                    <Input value={bankForm.ifscCode} onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. HDFC0001234" className="bg-[#111] border-zinc-700 text-white" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>UPI ID (optional)</Label>
                    <Input value={bankForm.upiId} onChange={e => setBankForm(f => ({ ...f, upiId: e.target.value }))}
                      placeholder="e.g. name@upi" className="bg-[#111] border-zinc-700 text-white" />
                  </div>
                </div>
                <Button type="submit" disabled={savingBank} className="bg-white text-black hover:bg-zinc-200">
                  {savingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Bank Account
                </Button>
              </form>
            </CardContent>
          </Card>

          {bankAccounts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Saved Accounts</h3>
              {bankAccounts.map(a => (
                <Card key={a.id} className={`bg-[#0b0b0b] border-[#1a1a1a] ${a.isPrimary ? "border-emerald-500/30" : ""}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{a.bankName} — ••••{a.accountNumber.slice(-4)}</p>
                      <p className="text-xs text-zinc-500">{a.accountHolderName} · IFSC: {a.ifscCode}</p>
                      {a.upiId && <p className="text-xs text-zinc-500">UPI: {a.upiId}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {a.isPrimary && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">Primary</Badge>}
                      {a.isVerified && <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">Verified</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
