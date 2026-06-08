"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { getAdminOrders, AdminOrderRow, PaginatedResult, adminUpdateOrderStatus, adminCreateShipmentForOrder } from "@/services/admin.service";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400",
  confirmed: "bg-blue-500/10 text-blue-400",
  processing: "bg-purple-500/10 text-purple-400",
  shipped: "bg-cyan-500/10 text-cyan-400",
  delivered: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-red-500/10 text-red-400",
};

export default function AdminOrdersPage() {
  const [data, setData] = useState<PaginatedResult<AdminOrderRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [creatingShipmentId, setCreatingShipmentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getAdminOrders({ status: statusFilter || undefined });
      setData(result);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="w-full space-y-8 text-white">
      {/* Header */}
      <div className="pb-6 border-b border-[#1f1f1f]">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-zinc-400 mt-1">Monitor all platform orders</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-[#111111] border border-[#1f1f1f] rounded-md text-white focus:outline-none focus:border-zinc-600"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {data && (
          <span className="text-xs text-zinc-500">{data.pagination.total} orders</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
          <ShoppingBag className="h-8 w-8 mb-3" />
          <p className="text-sm">No orders found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#1f1f1f] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#0b0b0b]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Shipment</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).map((order, i) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-[#1a1a1a] bg-[#111111] hover:bg-white/2 transition"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300">#{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div>
                      <p className="text-white text-xs">{order.profiles?.full_name ?? "—"}</p>
                      <p className="text-zinc-500 text-[10px]">{order.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      onChange={async (e) => {
                        try {
                          await adminUpdateOrderStatus(order.id, e.target.value);
                          toast.success(`Order updated to ${e.target.value}`);
                          loadData();
                        } catch {
                          toast.error("Failed to update order status");
                        }
                      }}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize border-0 focus:outline-none cursor-pointer ${STATUS_STYLES[order.status] ?? "bg-zinc-500/10 text-zinc-400"}`}
                    >
                      {["pending","confirmed","processing","shipped","delivered","cancelled"].map(s => (
                        <option key={s} value={s} className="bg-[#111] text-white capitalize">{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ₹{order.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {["confirmed","processing","shipped","delivered"].includes(order.status) && (
                      <button
                        disabled={creatingShipmentId === order.id}
                        title="Manually create Shiprocket shipment (use when shipment was never created)"
                        onClick={async () => {
                          setCreatingShipmentId(order.id);
                          try {
                            await adminCreateShipmentForOrder(order.id);
                            toast.success("Shipment created — check Shipments page for label/AWB");
                          } catch (e: any) {
                            toast.error(e.message || "Failed to create shipment");
                          } finally {
                            setCreatingShipmentId(null);
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {creatingShipmentId === order.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Truck className="w-3.5 h-3.5" />}
                        Create
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
