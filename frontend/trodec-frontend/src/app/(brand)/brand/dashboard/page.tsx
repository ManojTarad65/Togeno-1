"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Package,
  Megaphone,
  TrendingUp,
  Plus,
  ArrowRight,
  Loader2,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  Users,
  ChevronRight,
  LineChart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import {
  getBrandStats,
  BrandStats,
  getBrandProducts,
  getBrandOrders,
} from "@/services";
import { getSentPitches, PitchWithDetails, getPitchStatusLabel } from "@/services/pitch.service";
import { Product } from "@/services/products.service";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function BrandDashboardPage() {
  const router = useRouter();
  const { profile, brandDetails } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [recentPitches, setRecentPitches] = useState<PitchWithDetails[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      const [statsData, productsData, pitchesData, ordersData] = await Promise.allSettled([
        getBrandStats(),
        getBrandProducts({ limit: 4 }),
        getSentPitches({ limit: 4 }),
        getBrandOrders({ status: "pending", limit: 4 }),
      ]);

      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (productsData.status === "fulfilled") setRecentProducts(productsData.value.data);
      if (pitchesData.status === "fulfilled") setRecentPitches(pitchesData.value.data || []);
      if (ordersData.status === "fulfilled") setPendingOrders(ordersData.value.data || []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const totalRevenue = stats?.totalRevenue || 0;
  const totalOrders = stats?.totalOrders || 0;

  const metrics = [
    {
      label: "Net Profit",
      value: `₹${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtext: "After shipping & commission",
      icon: TrendingUp,
      accent: "from-emerald-500/10 to-transparent",
      iconColor: "text-emerald-500",
      borderHover: "hover:border-emerald-500/20",
    },
    {
      label: "Total Orders",
      value: totalOrders.toString(),
      subtext: "All time",
      icon: ShoppingCart,
      accent: "from-blue-500/10 to-transparent",
      iconColor: "text-blue-500",
      borderHover: "hover:border-blue-500/20",
    },
    {
      label: "Active Products",
      value: stats?.activeProducts?.toString() || "0",
      subtext: `${stats?.totalProducts || 0} total`,
      icon: Package,
      accent: "from-violet-500/10 to-transparent",
      iconColor: "text-violet-500",
      borderHover: "hover:border-violet-500/20",
    },
    {
      label: "Avg. Net / Order",
      value: totalOrders > 0 ? `₹${(totalRevenue / totalOrders).toFixed(2)}` : "₹0.00",
      subtext: "Lifetime",
      icon: DollarSign,
      accent: "from-amber-500/10 to-transparent",
      iconColor: "text-amber-500",
      borderHover: "hover:border-amber-500/20",
    },
  ];

  const pitchStatusStyles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    shipped: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    posted: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    completed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    cancelled: "bg-zinc-600/10 text-zinc-500 border-zinc-600/20",
    expired: "bg-zinc-600/10 text-zinc-500 border-zinc-600/20",
  };

  return (
    <div className="w-full max-w-[1600px] px-8 py-8 space-y-8 text-white">

      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#1f1f1f]"
      >
        <div className="flex items-center gap-4">
          {/* Brand Avatar */}
          <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#111111] flex-shrink-0">
            {brandDetails?.logoUrl ? (
              <Image
                src={brandDetails.logoUrl}
                alt={brandDetails.brandName || "Brand"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <span className="text-lg font-bold text-emerald-400">
                  {(brandDetails?.brandName || profile?.fullName || "B").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Welcome back,{" "}
              <span className="text-white">
                {brandDetails?.brandName || profile?.fullName || "Brand"}
              </span>
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Here&apos;s what&apos;s happening with your brand today.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => router.push("/brand/pitches/new")}
            variant="outline"
            className="h-9 text-sm bg-transparent border-[#1f1f1f] text-zinc-300 hover:text-white hover:bg-white/5"
          >
            <Megaphone className="w-3.5 h-3.5 mr-2" />
            New Pitch
          </Button>
          <Button
            onClick={() => router.push("/brand/products/new")}
            className="h-9 text-sm bg-white text-black hover:bg-zinc-200 font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Add Product
          </Button>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "group relative overflow-hidden p-5 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] transition-all duration-200",
              item.borderHover
            )}
          >
            {/* Subtle gradient accent */}
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", item.accent)} />

            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  {item.label}
                </span>
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center bg-white/5", item.iconColor)}>
                  <item.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight text-white">
                {item.value}
              </span>
              {item.subtext && (
                <p className="text-xs text-zinc-600 mt-1">{item.subtext}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Products */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <div>
              <h3 className="text-sm font-medium text-white">Recent Products</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">{stats?.totalProducts || 0} total listed</p>
            </div>
            <button
              onClick={() => router.push("/brand/products")}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="divide-y divide-[#151515]">
            {recentProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Package className="h-7 w-7 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500 font-medium">No products yet</p>
                <p className="text-xs text-zinc-700 mt-1">Add your first product to get started</p>
                <button
                  onClick={() => router.push("/brand/products/new")}
                  className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  + Add Product
                </button>
              </div>
            ) : (
              recentProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => router.push(`/brand/products/${product.id}`)}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0 border border-[#222]">
                    {product.images?.[0]?.imageUrl ? (
                      <Image
                        src={product.images[0].imageUrl}
                        alt={product.name}
                        width={36}
                        height={36}
                        className="object-cover h-full w-full"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">
                      {product.name}
                    </p>
                    <p className="text-xs text-zinc-600">
                      ₹{Number(product.price).toLocaleString()}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    product.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-700/20 text-zinc-500 border-zinc-700/30"
                  )}>
                    {product.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Pitches */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-1 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <div>
              <h3 className="text-sm font-medium text-white">Recent Pitches</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">Sent to experts</p>
            </div>
            <button
              onClick={() => router.push("/brand/pitches")}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="divide-y divide-[#151515]">
            {recentPitches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Megaphone className="h-7 w-7 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500 font-medium">No pitches sent</p>
                <p className="text-xs text-zinc-700 mt-1">Pitch to experts to grow your brand</p>
                <button
                  onClick={() => router.push("/brand/pitches/new")}
                  className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  + New Pitch
                </button>
              </div>
            ) : (
              recentPitches.map((pitch) => (
                <div
                  key={pitch.id}
                  onClick={() => router.push(`/brand/pitches/${pitch.id}`)}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 border border-[#222]">
                    <Megaphone className="h-4 w-4 text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">
                      Pitch #{pitch.id.slice(-6)}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {new Date(pitch.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    pitchStatusStyles[pitch.status] || "bg-zinc-700/20 text-zinc-500 border-zinc-700/30"
                  )}>
                    {getPitchStatusLabel(pitch.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Pending Orders */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-1 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <div>
              <h3 className="text-sm font-medium text-white">Pending Orders</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">Awaiting fulfillment</p>
            </div>
            <button
              onClick={() => router.push("/brand/orders")}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="divide-y divide-[#151515]">
            {pendingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <CheckCircle2 className="h-7 w-7 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500 font-medium">All caught up!</p>
                <p className="text-xs text-zinc-700 mt-1">No pending orders right now</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => router.push("/brand/orders")}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 border border-[#222]">
                    <ShoppingCart className="h-4 w-4 text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">
                      {order.orderNumber || `#${order.id.slice(-6)}`}
                    </p>
                    <p className="text-xs text-zinc-600">
                      ₹{Number(order.total || order.subtotal || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
                    Pending
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Analytics Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Performance Overview</h3>
            <p className="text-[11px] text-zinc-600 mt-0.5">Net profit and order volume over time</p>
          </div>
          <span className="text-[11px] text-zinc-600 border border-[#222] rounded-md px-2.5 py-1">
            Coming soon
          </span>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-[#2a2a2a] flex items-center justify-center mb-4">
            <LineChart className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No analytics available yet</p>
          <p className="text-xs text-zinc-600 mt-1.5 text-center max-w-xs">
            Analytics will appear here once your brand starts receiving orders and engagement.
          </p>
          <div className="flex items-center gap-2 mt-5">
            <Button
              onClick={() => router.push("/brand/products/new")}
              size="sm"
              className="h-8 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 border border-[#2a2a2a]"
              variant="outline"
            >
              <Plus className="h-3 w-3 mr-1.5" />
              Add Product
            </Button>
            <Button
              onClick={() => router.push("/brand/pitches/new")}
              size="sm"
              className="h-8 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 border border-[#2a2a2a]"
              variant="outline"
            >
              <Megaphone className="h-3 w-3 mr-1.5" />
              New Pitch
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Package,
              title: "Manage Inventory",
              desc: "Update stock & product details",
              href: "/brand/products",
              accent: "group-hover:text-violet-400",
            },
            {
              icon: ShoppingCart,
              title: "Process Orders",
              desc: "View and fulfill customer orders",
              href: "/brand/orders",
              accent: "group-hover:text-blue-400",
            },
            {
              icon: Megaphone,
              title: "View Pitches",
              desc: "Track your expert collaborations",
              href: "/brand/pitches",
              accent: "group-hover:text-amber-400",
            },
            {
              icon: Users,
              title: "Communities",
              desc: "Explore brand communities",
              href: "/brand/communities",
              accent: "group-hover:text-emerald-400",
            },
          ].map((action) => (
            <div
              key={action.href}
              onClick={() => router.push(action.href)}
              className="group cursor-pointer p-5 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#111] transition-all duration-200"
            >
              <div className="flex justify-between items-start mb-3">
                <action.icon className={cn("h-5 w-5 text-zinc-600 transition-colors duration-200", action.accent)} />
                <ArrowRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
              <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                {action.title}
              </p>
              <p className="text-xs text-zinc-600 mt-1">{action.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
