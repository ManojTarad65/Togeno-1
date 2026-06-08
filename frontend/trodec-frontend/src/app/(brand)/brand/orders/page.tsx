"use client";

import { useEffect, useState } from "react";
import { getBrandOrders, BrandOrder } from "@/services";
import { OrderService } from "@/services/order.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Search,
  Download,
  Package,
  ExternalLink,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { refreshShipmentLabel } from "@/services/shipment.service";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BrandOrdersPage() {
  const [orders, setOrders] = useState<BrandOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const [retryingLabelId, setRetryingLabelId] = useState<string | null>(null);

  const cancellableStatuses = ["pending", "confirmed", "processing"];

  async function handleCancelOrder(orderId: string) {
    setConfirmOrderId(null);
    setCancellingId(orderId);
    try {
      await OrderService.brandCancelOrder(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
      );
      toast.success("Order cancelled. Refund will be processed if applicable.");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRetryLabel(orderId: string, shipmentId: string) {
    setRetryingLabelId(orderId);
    try {
      const labelUrl = await refreshShipmentLabel(shipmentId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, labelUrl } : o))
      );
      toast.success("Label generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Label not ready yet — try again in a few minutes");
    } finally {
      setRetryingLabelId(null);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setIsLoading(true);
      const result = await getBrandOrders();
      setOrders(result.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.awbCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getOrderStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "shipped":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "processing":
      case "confirmed":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "pending":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getShipmentStatusColor = (status: string | null | undefined) => {
    switch (status?.toUpperCase()) {
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "OUT_FOR_DELIVERY":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "SHIPPED":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "PENDING":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "RETURNED":
      case "RTO":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const formatShipmentStatus = (status: string | null | undefined) => {
    if (!status) return "—";
    return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-400 px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1f1f] pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Orders
          </h1>
          <p className="text-sm text-zinc-400">
            Manage and track your customer orders.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search orders, AWB..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 bg-[#0b0b0b] border-[#1f1f1f] text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] overflow-hidden">
        <Table>
          <TableHeader className="bg-[#111111]">
            <TableRow className="border-[#1f1f1f] hover:bg-transparent">
              <TableHead className="text-zinc-500">Order #</TableHead>
              <TableHead className="text-zinc-500">Date</TableHead>
              <TableHead className="text-zinc-500">Product</TableHead>
              <TableHead className="text-zinc-500">Size</TableHead>
              <TableHead className="text-zinc-500">Qty</TableHead>
              <TableHead className="text-zinc-500">Amount</TableHead>
              <TableHead className="text-zinc-500">Order Status</TableHead>
              <TableHead className="text-zinc-500">AWB</TableHead>
              <TableHead className="text-zinc-500">Shipment</TableHead>
              <TableHead className="text-zinc-500">Label</TableHead>
              <TableHead className="text-zinc-500">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <Package className="h-6 w-6 text-zinc-700" />
                    No orders found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow
                  key={order.itemId ?? order.id}
                  className="border-[#1f1f1f] hover:bg-[#111111]"
                >
                  <TableCell className="font-mono text-sm text-white">
                    {order.orderNumber}
                  </TableCell>

                  <TableCell className="text-zinc-300 text-sm">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </TableCell>

                  <TableCell className="text-zinc-300 text-sm">
                    <div className="flex items-center gap-2">
                      {order.productImage && (
                        <img
                          src={order.productImage}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      {order.productName || "—"}
                    </div>
                  </TableCell>

                  <TableCell className="text-zinc-300 text-sm font-mono">
                    {order.selectedSize || "—"}
                  </TableCell>

                  <TableCell className="text-zinc-300 text-sm">
                    {order.quantity || 1}
                  </TableCell>

                  <TableCell className="text-white font-medium text-sm">
                    ₹{(order.total ?? 0).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        getOrderStatusColor(order.status)
                      )}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>

                  {/* AWB Number */}
                  <TableCell className="text-sm font-mono">
                    {order.awbCode ? (
                      <span className="text-zinc-200">{order.awbCode}</span>
                    ) : (
                      <span className="text-zinc-600">Pending</span>
                    )}
                  </TableCell>

                  {/* Shipment Status */}
                  <TableCell>
                    {order.shipmentStatus ? (
                      <Badge
                        variant="outline"
                        className={cn(getShipmentStatusColor(order.shipmentStatus))}
                      >
                        {formatShipmentStatus(order.shipmentStatus)}
                      </Badge>
                    ) : (
                      <span className="text-zinc-600 text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Download Label */}
                  <TableCell>
                    {order.labelUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 border-[#1f1f1f] bg-transparent text-zinc-300 hover:text-white hover:bg-white/5"
                        onClick={() => window.open(order.labelUrl!, "_blank")}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Label
                        <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                      </Button>
                    ) : order.awbCode && order.shipmentId ? (
                      // AWB exists but label failed — brand can retry
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryingLabelId === order.id}
                        className="h-7 px-2 border-amber-500/30 bg-transparent text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={() => handleRetryLabel(order.id, order.shipmentId!)}
                        title="Label generation failed — click to retry"
                      >
                        {retryingLabelId === order.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                        Retry
                      </Button>
                    ) : order.hasShiprocketShipment ? (
                      // Shipment on Shiprocket but no AWB yet (wallet/KYC issue)
                      <span className="flex items-center gap-1 text-zinc-600 text-xs" title="AWB not assigned yet — contact admin to retry">
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        Awaiting AWB
                      </span>
                    ) : (
                      // No shipment at all
                      <span className="flex items-center gap-1 text-zinc-600 text-xs" title="Shipment not created yet — contact admin">
                        <AlertCircle className="h-3 w-3 text-zinc-600" />
                        Not created
                      </span>
                    )}
                  </TableCell>

                  {/* Cancel */}
                  <TableCell>
                    {cancellableStatuses.includes(order.status) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        disabled={cancellingId === order.id}
                        onClick={() => setConfirmOrderId(order.id)}
                      >
                        {cancellingId === order.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmOrderId} onOpenChange={(open) => !open && setConfirmOrderId(null)}>
        <AlertDialogContent className="bg-[#0e0e0e] border border-[#1f1f1f] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will cancel the customer's order. If payment was made, a full refund will be initiated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#2a2a2a] text-zinc-300 hover:bg-white/5">
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmOrderId && handleCancelOrder(confirmOrderId)}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
