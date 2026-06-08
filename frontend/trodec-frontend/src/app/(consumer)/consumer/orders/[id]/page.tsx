"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Order, OrderService } from "@/services/order.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, ArrowLeft, Package, MapPin, CreditCard,
  Truck, ExternalLink, CheckCircle2, Circle, Clock,
  AlertTriangle, CheckCheck, Copy,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Status pipeline — the visual stepper
// ─────────────────────────────────────────────
const PIPELINE = [
  { key: "pending",   label: "Order Placed"  },
  { key: "confirmed", label: "Confirmed"      },
  { key: "processing",label: "Processing"     },
  { key: "shipped",   label: "Shipped"        },
  { key: "delivered", label: "Delivered"      },
] as const;

const STATUS_RANK: Record<string, number> = {
  pending: 0, confirmed: 1, processing: 2, shipped: 3, delivered: 4, cancelled: -1,
};

function OrderStepper({ status }: { status: string }) {
  const rank = STATUS_RANK[status] ?? 0;
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
        <AlertTriangle className="w-4 h-4" /> Order Cancelled
      </div>
    );
  }
  return (
    <div className="flex items-center w-full">
      {PIPELINE.map((step, i) => {
        const done    = rank > i;
        const current = rank === i;
        const last    = i === PIPELINE.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done    ? "bg-emerald-500 text-white" :
                current ? "bg-white text-black ring-2 ring-white/30" :
                          "bg-white/6 text-zinc-600"
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap ${
                done ? "text-emerald-400" : current ? "text-white" : "text-zinc-600"
              }`}>{step.label}</span>
            </div>
            {!last && (
              <div className={`flex-1 h-px mx-1 mb-5 transition-all ${rank > i ? "bg-emerald-500" : "bg-white/8"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tracking events timeline
// ─────────────────────────────────────────────
function TrackingTimeline({ events }: { events: Array<{ status: string; label: string; location: string; timestamp: string }> }) {
  if (!events.length) return <p className="text-zinc-600 text-sm">No tracking updates yet.</p>;
  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-white" : "bg-zinc-600"}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-white/8 my-1" />}
          </div>
          <div className="pb-5">
            <p className={`text-sm font-semibold ${i === 0 ? "text-white" : "text-zinc-400"}`}>{e.label}</p>
            {e.location && <p className="text-xs text-zinc-600 mt-0.5">{e.location}</p>}
            {e.timestamp && (
              <p className="text-xs text-zinc-700 mt-0.5">
                {new Date(e.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function OrderDetailsPage() {
  const params  = useParams();
  const router  = useRouter();
  const orderId = params.id as string;

  const [order,          setOrder]          = useState<Order | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [cancelling,     setCancelling]     = useState(false);
  const [confirming,     setConfirming]     = useState(false);
  const [showCancel,     setShowCancel]     = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    OrderService.getOrderById(orderId)
      .then(setOrder)
      .catch(() => { setError("Failed to load order."); toast.error("Failed to load order"); })
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleCancel = async () => {
    if (!order) return;
    setShowCancel(false);
    setCancelling(true);
    try {
      const updated = await OrderService.cancelOrder(order.id);
      setOrder(updated);
      toast.success("Order cancelled. Refund will be processed if applicable.");
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel order");
    } finally { setCancelling(false); }
  };

  const handleConfirmReceipt = async () => {
    if (!order) return;
    setShowConfirm(false);
    setConfirming(true);
    try {
      const updated = await OrderService.confirmReceipt(order.id);
      setOrder(updated);
      toast.success("Thank you! Order marked as delivered.");
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm receipt");
    } finally { setConfirming(false); }
  };

  const copyAWB = (awb: string) => {
    navigator.clipboard.writeText(awb);
    toast.success("Tracking number copied");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
    </div>
  );

  if (error || !order) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-white">
      <Package className="w-10 h-10 text-zinc-600" />
      <p className="text-zinc-400">{error || "Order not found"}</p>
      <Button variant="outline" onClick={() => router.push("/consumer/orders")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to orders
      </Button>
    </div>
  );

  const { shipment } = order;
  const canCancel    = ["pending", "confirmed", "processing"].includes(order.status);
  const canConfirm   = ["shipped", "processing"].includes(order.status);
  const isDelivered  = order.status === "delivered";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 space-y-8 pt-4 text-white">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Order #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-zinc-500 text-sm mt-1">Placed on {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canConfirm && (
            <Button
              disabled={confirming}
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold h-10 px-5"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Confirm Receipt
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              disabled={cancelling}
              onClick={() => setShowCancel(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl h-10 px-5"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Order"}
            </Button>
          )}
        </div>
      </div>

      {/* Status stepper */}
      <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl p-6">
        <OrderStepper status={order.status} />
        {isDelivered && (
          <p className="text-emerald-400 text-sm font-semibold mt-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Delivered{shipment?.deliveredAt ? ` on ${fmtDate(shipment.deliveredAt)}` : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Tracking card — shown when shipment exists */}
          {shipment && (
            <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-4 h-4" /> Shipment Tracking
              </h2>

              {/* AWB + courier */}
              <div className="flex flex-wrap gap-4">
                {shipment.awbCode && (
                  <div className="bg-white/3 border border-white/6 rounded-xl px-4 py-3 flex items-center gap-3 flex-1 min-w-50">
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">AWB / Tracking No.</p>
                      <p className="font-mono text-white font-semibold text-sm">{shipment.awbCode}</p>
                      {shipment.carrier && <p className="text-zinc-600 text-xs mt-0.5">via {shipment.carrier}</p>}
                    </div>
                    <button onClick={() => copyAWB(shipment.awbCode!)} className="ml-auto text-zinc-600 hover:text-white transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {shipment.estimatedDelivery && (
                  <div className="bg-white/3 border border-white/6 rounded-xl px-4 py-3 flex-1 min-w-40">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Expected Delivery</p>
                    <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {fmtDate(shipment.estimatedDelivery)}
                    </p>
                  </div>
                )}
              </div>

              {/* Track externally */}
              {shipment.trackingUrl && (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Track on Shiprocket
                </a>
              )}

              {/* Timeline */}
              {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
                <>
                  <Separator className="bg-white/6" />
                  <div>
                    <p className="text-xs text-zinc-600 uppercase tracking-wider mb-4">Timeline</p>
                    <TrackingTimeline events={shipment.trackingEvents} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Order items */}
          <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/6">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4" /> Items
              </h2>
            </div>
            <div className="divide-y divide-white/4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-5">
                  <div className="w-16 h-16 rounded-xl bg-white/4 border border-white/6 overflow-hidden shrink-0 relative">
                    {item.imageUrl
                      ? <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                      : <div className="flex h-full w-full items-center justify-center"><Package className="w-6 h-6 text-zinc-700" /></div>
                    }
                  </div>
                  <div className="flex flex-1 justify-between items-start">
                    <div>
                      <p className="text-white font-semibold text-sm">{item.productName}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Qty {item.quantity} × {fmt(item.price)}</p>
                    </div>
                    <p className="text-white font-bold text-sm">{fmt(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div className="space-y-5">

          {/* Order summary */}
          <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span><span className="text-white">{fmt(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Shipping</span><span className="text-emerald-400">Free</span>
              </div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Discount {order.promoCode && <span className="text-xs font-mono text-zinc-600 ml-1">({order.promoCode})</span>}</span>
                  <span className="text-emerald-400">−{fmt(order.discountAmount!)}</span>
                </div>
              )}
              <Separator className="bg-white/6" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span><span>{fmt(order.total)}</span>
              </div>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/6 px-3 py-2.5 flex justify-between items-center text-sm">
              <span className="text-zinc-500">Payment</span>
              <Badge variant="outline" className={`text-xs font-semibold capitalize border ${
                order.paymentStatus === "paid" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-zinc-400 border-zinc-700"
              }`}>
                {order.paymentStatus}
              </Badge>
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4" /> Delivery Address
            </h2>
            <address className="not-italic text-sm space-y-0.5">
              <p className="text-white font-semibold">{order.shippingName}</p>
              <p className="text-zinc-400">{order.shippingPhone}</p>
              <p className="text-zinc-400 mt-1">{order.shippingAddressLine1}</p>
              {order.shippingAddressLine2 && <p className="text-zinc-400">{order.shippingAddressLine2}</p>}
              <p className="text-zinc-400">{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</p>
            </address>
          </div>

          {/* Documents */}
          {shipment && (shipment.labelUrl || shipment.invoiceUrl) && (
            <div className="bg-[#0a0a0c] border border-white/6 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Documents</h2>
              {shipment.invoiceUrl && (
                <a href={shipment.invoiceUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Download Invoice
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel dialog */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent className="bg-[#0e0e0e] border border-[#1f1f1f] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Cancel this order?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-1">
              <span className="block">This cannot be undone:</span>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                <li>Order permanently cancelled</li>
                <li>Full refund initiated if paid (5–7 business days)</li>
                <li>Shipment cancelled with courier</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#2a2a2a] text-zinc-300 hover:bg-white/5">Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-500 text-white">Yes, Cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm receipt dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-[#0e0e0e] border border-[#1f1f1f] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-emerald-400" /> Confirm you received this order?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Only confirm if you have physically received and inspected your package. This action cannot be undone and will close the order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#2a2a2a] text-zinc-300 hover:bg-white/5">Not Yet</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReceipt} className="bg-emerald-600 hover:bg-emerald-500 text-white">Yes, I Received It</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
