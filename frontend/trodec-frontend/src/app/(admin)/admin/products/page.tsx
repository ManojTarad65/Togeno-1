"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAdminProducts, adminDeleteProduct, AdminProductRow, PaginatedResult } from "@/services/admin.service";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  draft: "bg-zinc-500/10 text-zinc-400",
  inactive: "bg-red-500/10 text-red-400",
};

export default function AdminProductsPage() {
  const [data, setData] = useState<PaginatedResult<AdminProductRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getAdminProducts({ status: statusFilter || undefined });
      setData(result);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete(productId: string) {
    setDeletingId(productId);
    try {
      await adminDeleteProduct(productId);
      toast.success("Product deleted");
      setData((prev) =>
        prev
          ? { ...prev, data: prev.data.filter((p) => p.id !== productId), pagination: { ...prev.pagination, total: prev.pagination.total - 1 } }
          : prev
      );
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="w-full space-y-8 text-white">
      {/* Header */}
      <div className="pb-6 border-b border-[#1f1f1f]">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-zinc-400 mt-1">Browse all products on the platform</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-[#111111] border border-[#1f1f1f] rounded-md text-white focus:outline-none focus:border-zinc-600"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
        {data && (
          <span className="text-xs text-zinc-500">{data.pagination.total} products</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
          <Package className="h-8 w-8 mb-3" />
          <p className="text-sm">No products found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#1f1f1f] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#0b0b0b]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Rating</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).map((product, i) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-[#1a1a1a] bg-[#111111] hover:bg-white/[0.02] transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-white line-clamp-1">{product.name}</p>
                        {product.is_featured && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Featured</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-zinc-400">
                    {product.brand_details?.brand_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-400">
                    {product.categories?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[product.status] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-right">
                    {product.review_count > 0 ? (
                      <span className="flex items-center justify-end gap-1 text-xs text-zinc-400">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        {product.average_rating.toFixed(1)}
                        <span className="text-zinc-600">({product.review_count})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmId === product.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                        >
                          {deletingId === product.id ? "Deleting..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700/60 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(product.id)}
                        className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Delete product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
