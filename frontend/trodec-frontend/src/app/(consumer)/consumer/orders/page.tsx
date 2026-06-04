"use client";

import { Card, CardContent, Button, Badge } from "@/components/ui";
import { Package, Search, ShoppingBag, Loader2, Download, RefreshCw, ChevronRight, CheckCircle2, Navigation, Circle, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { OrderService, Order } from "@/services/order.service";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function OrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
    const cancellableStatuses = ["pending", "confirmed", "processing"];

    async function handleCancel(orderId: string) {
        setConfirmOrderId(null);
        setCancellingId(orderId);
        try {
            await OrderService.cancelOrder(orderId);
            setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "cancelled" } : o));
            toast.success("Order cancelled. Refund will be processed if applicable.");
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel order");
        } finally {
            setCancellingId(null);
        }
    }

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
            router.push('/login?redirectTo=/consumer/orders');
            return;
        }
        loadOrders();
    }, []);

    async function loadOrders() {
        try {
            setLoading(true);
            const result = await OrderService.getMyOrders();
            setOrders(result.data);
        } catch (error: any) {
            console.error('Failed to load orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || order.id.includes(searchQuery.toLowerCase());
        const orderStatus = order.status.toLowerCase();
        let normalizedFilter = statusFilter;
        // Map "processing" filter to match "pending", "confirmed", "processing"
        if (statusFilter === 'processing') {
            const isProcessing = ['pending', 'confirmed', 'processing'].includes(orderStatus);
            if (!isProcessing) return false;
        } else {
            const matchesStatus = statusFilter === "all" || orderStatus === statusFilter.toLowerCase();
            if (!matchesStatus) return false;
        }

        return matchesSearch;
    });

    const renderStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        let colorClasses = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
        if (s === 'delivered') colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
        else if (s === 'shipped') colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]';
        else if (s === 'processing' || s === 'pending' || s === 'confirmed') colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
        else if (s === 'cancelled') colorClasses = 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]';

        return (
            <Badge variant="outline" className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${colorClasses}`}>
                {status}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-24 px-4 sm:px-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 mt-2">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1.5">Your Orders</h1>
                    <p className="text-zinc-400 text-sm md:text-base font-medium">
                        Track and manage your purchases
                    </p>
                </div>
                <Button onClick={() => router.push('/consumer/products')} className="bg-white text-black hover:bg-zinc-200 font-bold rounded-xl px-8 h-12 shadow-[0_4px_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all w-full md:w-auto">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Start New Order
                </Button>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                    <Input
                        placeholder="Search your orders..."
                        className="pl-11 h-12 bg-[#0a0a0c] border border-white/[0.08] focus:border-white/20 rounded-xl text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-[#0a0a0c] border border-white/[0.08] rounded-xl p-1 overflow-x-auto scrollbar-hide shrink-0" style={{ scrollbarWidth: "none" }}>
                   {['All', 'Processing', 'Shipped', 'Delivered'].map(status => (
                       <button
                           key={status}
                           onClick={() => setStatusFilter(status === 'All' ? 'all' : status.toLowerCase())}
                           className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all active:scale-95 ${
                               (statusFilter === 'all' && status === 'All') || statusFilter === status.toLowerCase()
                               ? 'bg-white/[0.08] text-white shadow-sm'
                               : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                           }`}
                       >
                           {status}
                       </button>
                   ))}
                </div>
            </div>

            {/* ORDER LIST */}
            {filteredOrders.length === 0 ? (
                 <motion.div 
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                     className="flex flex-col items-center justify-center py-20 px-6 bg-[#08080a] rounded-3xl border border-white/[0.08] shadow-2xl relative overflow-hidden group"
                 >
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-purple-500/10 transition-all duration-700" />
                     <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-5 border border-white/[0.08] relative z-10 shadow-lg">
                        <Package className="w-8 h-8 text-zinc-500" />
                     </div>
                     <h2 className="text-xl font-black text-white mb-2 relative z-10">You haven’t ordered anything yet</h2>
                     <p className="text-zinc-500 text-sm mb-6 text-center max-w-sm relative z-10">When you place orders, they will securely appear here.</p>
                    <Button onClick={() => router.push('/consumer/products')} className="relative z-10 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 h-11 px-8 active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        Explore Products
                    </Button>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredOrders.map((order) => {
                            const firstItem = order.items?.[0];
                            const additionalItems = (order.items?.length || 0) > 1 ? order.items!.length - 1 : 0;
                            
                            return (
                             <motion.div 
                                 key={order.id}
                                 initial={{ opacity: 0, y: 20 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 exit={{ opacity: 0, scale: 0.95 }}
                                 className="group bg-[#0a0a0c] rounded-2xl border border-white/[0.06] hover:border-white/[0.12] shadow-lg hover:shadow-2xl hover:shadow-black/60 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
                             >
                                <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    
                                    {/* LEFT: Product Info */}
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-20 h-20 rounded-xl bg-[#050505] border border-white/[0.08] overflow-hidden shrink-0 shadow-inner relative">
                                            {firstItem?.imageUrl ? (
                                                <img src={firstItem.imageUrl} alt={firstItem.productName} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-zinc-700" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col justify-center space-y-1.5">
                                            <p className="text-white font-bold text-base line-clamp-1 group-hover:text-purple-300 transition-colors">
                                                {firstItem?.productName || 'Order Items'}
                                                {additionalItems > 0 && <span className="text-zinc-500 text-sm ml-2 font-medium">+{additionalItems} more</span>}
                                            </p>
                                            <p className="text-zinc-500 text-xs font-mono">Order #{order.orderNumber || order.id.slice(0, 8)}</p>
                                            <div className="flex items-center gap-3 pt-1">
                                                <p className="text-zinc-400 text-sm font-medium">
                                                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                <p className="text-white font-black text-sm">₹{order.total.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: Status & Actions */}
                                    <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center justify-end gap-4 shrink-0 mt-2 md:mt-0 pt-4 md:pt-0 border-t border-white/[0.06] md:border-none">
                                        <div className="flex justify-start sm:justify-end md:justify-start lg:justify-end">
                                            {renderStatusBadge(order.status)}
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 sm:flex-none rounded-xl border-white/10 hover:bg-white/5 hover:text-white h-10 px-5 text-xs font-bold transition-all active:scale-95 bg-[#0a0a0c]"
                                                onClick={() => router.push(`/consumer/orders/${order.id}`)}
                                            >
                                                View Details
                                            </Button>
                                            {order.status.toLowerCase() !== 'pending' && order.status.toLowerCase() !== 'cancelled' && (
                                                <Button
                                                    className="flex-1 sm:flex-none rounded-xl bg-white text-black hover:bg-zinc-200 h-10 px-5 text-xs font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                                    onClick={() => router.push(`/consumer/orders/${order.id}`)}
                                                >
                                                    Track Order
                                                </Button>
                                            )}
                                            {cancellableStatuses.includes(order.status.toLowerCase()) && (
                                                <Button
                                                    variant="outline"
                                                    disabled={cancellingId === order.id}
                                                    className="flex-1 sm:flex-none rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 h-10 px-5 text-xs font-bold transition-all active:scale-95 bg-[#0a0a0c]"
                                                    onClick={() => setConfirmOrderId(order.id)}
                                                >
                                                    {cancellingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    
                                </div>
                            </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <AlertDialog open={!!confirmOrderId} onOpenChange={(open) => !open && setConfirmOrderId(null)}>
                <AlertDialogContent className="bg-[#0e0e0e] border border-[#1f1f1f] text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 space-y-1">
                            <span className="block">This cannot be undone:</span>
                            <ul className="list-disc list-inside text-sm space-y-0.5">
                                <li>Order will be permanently cancelled</li>
                                <li>Full refund initiated if payment was made (5–7 business days)</li>
                                <li>Shipment will be cancelled with the courier</li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-[#2a2a2a] text-zinc-300 hover:bg-white/5">
                            Keep Order
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmOrderId && handleCancel(confirmOrderId)}
                            className="bg-red-600 hover:bg-red-500 text-white"
                        >
                            Yes, Cancel Order
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
