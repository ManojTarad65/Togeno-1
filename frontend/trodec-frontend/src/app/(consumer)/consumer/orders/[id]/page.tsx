"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Order, OrderService } from "@/services/order.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, ArrowLeft, Package, MapPin, Calendar, CreditCard, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const orderId = params.id as string;

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) return;

            try {
                setIsLoading(true);
                const data = await OrderService.getOrderById(orderId);
                setOrder(data);
            } catch (err) {
                console.error("Failed to fetch order:", err);
                setError("Failed to load order details. Please try again.");
                toast.error("Failed to load order details");
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();
    }, [orderId]);

    const cancellableStatuses = ["pending", "confirmed", "processing"];
    const canCancel = order && cancellableStatuses.includes(order.status);

    const handleCancel = async () => {
        if (!order) return;
        setShowCancelDialog(false);
        try {
            setCancelling(true);
            const updated = await OrderService.cancelOrder(order.id);
            setOrder(updated);
            toast.success("Order cancelled. A refund will be processed if payment was made.");
        } catch {
            toast.error("Failed to cancel order. Please contact support.");
        } finally {
            setCancelling(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading order details...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="bg-red-500/10 p-4 rounded-full">
                    <Package className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold">Order Not Found</h2>
                <p className="text-muted-foreground max-w-md text-center">{error || "The order you are looking for does not exist or you do not have permission to view it."}</p>
                <Button onClick={() => router.push("/consumer/orders")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Orders
                </Button>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "delivered":
                return "bg-green-500 hover:bg-green-600";
            case "shipped":
                return "bg-blue-500 hover:bg-blue-600";
            case "processing":
                return "bg-yellow-500 hover:bg-yellow-600";
            case "cancelled":
                return "bg-red-500 hover:bg-red-600";
            default:
                return "bg-gray-500 hover:bg-gray-600";
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Order #{order.id.slice(0, 8)}</h1>
                    </div>
                    <p className="text-muted-foreground ml-10">
                        Placed on {formatDate(order.createdAt)}
                    </p>
                </div>
                <div className="flex items-center gap-3 ml-10 md:ml-0">
                    <Badge className={`${getStatusColor(order.status)} text-white px-3 py-1 text-sm capitalize`}>
                        {order.status}
                    </Badge>
                    {canCancel && (
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelling}
                            onClick={() => setShowCancelDialog(true)}
                        >
                            {cancelling ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Cancelling...</> : "Cancel Order"}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Order Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex gap-4 p-6">
                                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-muted relative">
                                            {item.imageUrl ? (
                                                <Image
                                                    src={item.imageUrl}
                                                    alt={item.productName}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
                                                    <Package className="h-8 w-8" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-1 flex-col justify-between">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <h3 className="font-medium">{item.productName}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        Qty: {item.quantity} × {formatCurrency(item.price)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold">{formatCurrency(item.total)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Order Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping</span>
                                <span>{formatCurrency(order.shippingCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span>{formatCurrency(order.tax)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-medium text-lg">
                                <span>Total</span>
                                <span>{formatCurrency(order.total)}</span>
                            </div>
                            <div className="pt-4">
                                <div className="rounded-lg bg-muted p-3 text-sm flex justify-between items-center">
                                    <span className="text-muted-foreground">Payment Status</span>
                                    <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'} className="capitalize">
                                        {order.paymentStatus}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Shipping Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <address className="not-italic text-sm text-muted-foreground space-y-1">
                                <p className="font-medium text-foreground">{order.shippingName}</p>
                                <p>{order.shippingAddressLine1}</p>
                                {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                                <p>
                                    {order.shippingCity}, {order.shippingState} {order.shippingPostalCode}
                                </p>
                                <p>{order.shippingCountry}</p>
                            </address>
                        </CardContent>
                    </Card>

                   {order.trackingNumber && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Tracking Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-2">Tracking Number:</p>
                                <p className="font-mono bg-muted p-2 rounded text-center select-all">
                                    {order.trackingNumber}
                                </p>
                            </CardContent>
                        </Card>
                   )}
                </div>
            </div>

            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogContent className="bg-[#0e0e0e] border border-[#1f1f1f] text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            Cancel this order?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 space-y-2">
                            <span className="block">This cannot be undone. The following will happen immediately:</span>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Your order will be permanently cancelled</li>
                                <li>If payment was made, a full refund will be initiated (5–7 business days)</li>
                                <li>The shipment (if any) will be cancelled with the courier</li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-[#2a2a2a] text-zinc-300 hover:bg-white/5">
                            Keep Order
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCancel}
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
