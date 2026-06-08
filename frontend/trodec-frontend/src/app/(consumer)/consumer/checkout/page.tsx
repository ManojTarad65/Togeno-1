"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Separator,
} from "@/components/ui";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Lock,
  ShieldCheck,
  Clock,
  Package,
  RotateCcw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getAddresses, Address, createAddress } from "@/services/address.service";
import { OrderService } from "@/services/order.service";
import { useCart } from "@/hooks/useCart";
import { useAuthStore } from "@/stores/auth.store";
import { useModalStore } from "@/stores/modal.store";
import { useFunnel } from "@/hooks/useFunnel";
import { analytics } from "@/services/analytics.service";

// Razorpay global type
declare global {
  // eslint-disable-next-line no-var
  var Razorpay: new (options: Record<string, unknown>) => { open(): void };
}

// Load Razorpay checkout script once
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (globalThis.document?.getElementById("razorpay-script")) {
      resolve(true);
      return;
    }
    const script = globalThis.document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    globalThis.document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
      <CheckoutContent />
    </React.Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourcePostId = searchParams.get("postId");
  const { items, subtotal, clearCart, isLoading: cartLoading } = useCart();
  const initDone = useRef(false);
  const { isAuthenticated, profile } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const { advanceTo } = useFunnel();

  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState("");
  // Tracks a pending order created but not yet paid — reused on retry to prevent duplicates
  const pendingOrderRef = useRef<{ id: string; orderNumber: string } | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addressForm, setAddressForm] = useState({
    fullName: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
  });

  // Shipping is always free — charged to Trodec, not the customer
  const shippingCost = 0;

  // Promo code state
  const [promoInput, setPromoInput]     = useState("");
  const [promoCode, setPromoCode]       = useState<string | null>(null);
  const [discountPct, setDiscountPct]   = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);

  const discountAmount = promoCode ? Math.round((subtotal * discountPct) / 100 * 100) / 100 : 0;
  const total = subtotal - discountAmount;

  useEffect(() => {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login required to checkout", onComplete: () => {
        loadAddresses();
      }});
      return;
    }

    // Wait for cart to finish syncing before checking if it's empty
    if (cartLoading) return;

    if (items.length === 0 && !complete) {
      toast.error("Your cart is empty");
      router.push("/consumer/cart");
      return;
    }

    // Guard against double-init when cartLoading flips
    if (initDone.current) return;
    initDone.current = true;

    analytics.track('checkout_start', {
       item_count: items.length,
       total_value: total
    });
    advanceTo('Checkout');

    loadAddresses();
    loadRazorpayScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLoading]);

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    try {
      const result = await OrderService.validatePromo(code);
      setPromoCode(result.code);
      setDiscountPct(result.discountPct);
      toast.success(`${result.label} applied!`);
    } catch (e: any) {
      toast.error(e.message || "Invalid promo code");
      setPromoCode(null);
      setDiscountPct(0);
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoCode(null);
    setDiscountPct(0);
    setPromoInput("");
  }

  async function loadAddresses() {
    try {
      setLoading(true);
      const data = await getAddresses();
      setAddresses(data);
      if (data.length > 0) {
        setSelectedAddress(data[0].id);
      } else {
        setShowAddressForm(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAutoFill = () => {
    setAddressForm((prev) => ({
      ...prev,
      fullName: profile?.fullName ?? prev.fullName,
    }));
    setShowAddressForm(true);
    toast.success("Name filled from your profile — please complete the address");
  };

  async function handleSaveAddress() {
    if (
      !addressForm.fullName ||
      !addressForm.phoneNumber ||
      !addressForm.addressLine1 ||
      !addressForm.city ||
      !addressForm.state ||
      !addressForm.postalCode
    ) {
      toast.error("Please fill all required fields (*)");
      return;
    }
    const newAddress = await createAddress(addressForm);
    setAddresses((prev) => [...prev, newAddress]);
    setSelectedAddress(newAddress.id);
    setShowAddressForm(false);
  }

  async function handlePlaceOrder() {
    if (!selectedAddress) {
      toast.error("Select a shipping address");
      return;
    }

    try {
      setPlacing(true);

      // Reuse an existing pending order on retry to prevent duplicate order creation
      let order = pendingOrderRef.current
        ? await OrderService.getOrderById(pendingOrderRef.current.id).catch(() => null)
        : null;

      if (!order || order.status !== "pending") {
        order = await OrderService.createOrder({
          shippingAddressId: selectedAddress,
          billingAddressId: selectedAddress,
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity, selectedSize: i.selectedSize ?? null })),
          sourcePostId: sourcePostId ?? null,
          promoCode: promoCode ?? null,
        });
        pendingOrderRef.current = { id: order.id, orderNumber: order.orderNumber ?? order.id.slice(0, 8) };
      }

      const paymentInit = await OrderService.initiatePayment(order.id);

      const loaded = await loadRazorpayScript();
      if (!loaded || !globalThis.Razorpay) {
        toast.error("Payment gateway failed to load. Please try again.");
        setPlacing(false);
        return;
      }

      const rzp = new globalThis.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: paymentInit.amount * 100, // paise
        currency: paymentInit.currency,
        order_id: paymentInit.razorpayOrderId,
        name: "Trodec",
        description: `Order #${order.orderNumber ?? order.id.slice(0, 8)}`,
        theme: { color: "#ffffff" },

        // Step 5 — On payment success, verify with backend
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await OrderService.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            // Payment verified — order is now confirmed
            const oNum = order.orderNumber ?? order.id.slice(0, 8);
            
            // Analytics: Purchase completed
            analytics.track('purchase_complete', {
               order_id: order.id,
               order_number: oNum,
               total_value: total,
               currency: paymentInit.currency,
               item_count: items.length
            });
            advanceTo('Success');

            pendingOrderRef.current = null;
            setOrderNumber(oNum);
            clearCart();
            toast.success("Payment successful!");
            router.push(`/consumer/checkout/success?orderNumber=${oNum}`);
          } catch {
            toast.error("Payment verification failed. Contact support.");
          } finally {
            setPlacing(false);
          }
        },

        // Step 6 — On modal close without payment
        modal: {
          ondismiss: () => {
            toast.error("Payment cancelled");
            setPlacing(false);
          },
        },
      });

      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order";
      toast.error(msg);
      setPlacing(false);
    }
  }



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 pb-32">
        
        {/* ENHANCED STEP INDICATOR */}
        <div className="flex items-center justify-center gap-4 mb-16 max-w-xl mx-auto">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
               <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Cart</span>
          </div>
          <div className="h-px w-20 bg-emerald-500/20 mb-6" />
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(255,255,255,0.2)]">
               2
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Payment</span>
          </div>
          <div className="h-px w-20 bg-white/10 mb-6" />
          <div className="flex flex-col items-center gap-3 opacity-30">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-black">
               3
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Confirm</span>
          </div>
        </div>

      <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 relative">

      {/* LEFT COLUMN: Address & Payment */}
      <div className="lg:col-span-7 space-y-10">
        
        {/* URGENCY BANNER */}
        <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 text-emerald-300 px-5 py-4 rounded-xl">
           <Clock className="w-4 h-4 shrink-0" />
           <p className="text-sm font-medium tracking-wide">Your premium selection is reserved for 10 minutes</p>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white tracking-tight">Secure Checkout</h1>
          <p className="text-gray-400 font-medium">Complete your shipping and payment details below.</p>
        </div>

        {/* Shipping Address */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Shipping Address
             </h2>
             <div className="flex items-center gap-4">
                <button
                   onClick={handleAutoFill}
                   className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 bg-emerald-400/5 px-2.5 py-1.5 rounded-lg border border-emerald-400/10"
                >
                   ⚡ Auto-fill
                </button>
                <Button
                   variant="ghost"
                   className="text-gray-400 hover:text-white h-auto p-0 font-bold"
                   onClick={() => setShowAddressForm((v) => !v)}
                >
                  + Add new
                </Button>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              onClick={() => setSelectedAddress(addr.id)}
              className={`cursor-pointer transition-all duration-300 rounded-xl p-5 relative overflow-hidden group ${
                selectedAddress === addr.id
                  ? "bg-[#141416] ring-1 ring-white/20 border border-white/10 shadow-lg"
                  : "bg-[#0a0a0a] border border-white/5 hover:border-white/10"
              }`}
            >
              {selectedAddress === addr.id && (
                 <div className="absolute top-4 right-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                 </div>
              )}
              <div className="pr-8">
                 <div className="font-bold text-white mb-2">{addr.fullName}</div>
                 <div className="text-sm text-gray-400 space-y-1">
                    <p>{addr.addressLine1}</p>
                    {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                    <p>{addr.city}, {addr.state} {addr.postalCode}</p>
                    <p className="text-gray-500 mt-3 font-bold">
                       {addr.phoneNumber} 
                    </p>
                 </div>
              </div>
            </div>
          ))}
          </div>

          {showAddressForm && (
            <Card className="bg-[#111111] border border-[#1f1f1f]">
              <CardContent className="p-6 space-y-4">
                <Input
                  placeholder="Full Name *"
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-offset-0 focus-visible:ring-white/20 h-12 scroll-m-24"
                />
                <Input
                  placeholder="Phone Number *"
                  value={addressForm.phoneNumber}
                  onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                  className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                />
                <Input
                  placeholder="Address Line 1 *"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                />
                <Input
                  placeholder="Address Line 2"
                  value={addressForm.addressLine2}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                  className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="City *"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                  />
                  <Input
                    placeholder="State *"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Postal Code *"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                  />
                  <Input
                    placeholder="Country"
                    value={addressForm.country}
                    onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                    className="bg-black/30 border-[#1f1f1f] h-12 scroll-m-24"
                  />
                </div>
                <Button onClick={handleSaveAddress} className="bg-white text-black hover:bg-zinc-200 h-12 w-full mt-2 font-bold">
                  Save Address
                </Button>
              </CardContent>
            </Card>
          )}

        </section>

        {/* Payment Selection */}
        <section className="space-y-6 pt-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
             Payment Method
          </h2>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-7 relative overflow-hidden backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <h3 className="font-semibold text-white text-lg">Razorpay Secure</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-5 max-w-sm leading-relaxed">
                    100% encrypted checkout. Supports UPI, Credit/Debit Cards, Net Banking, and major Wallets.
                  </p>
                  <div className="flex gap-2">
                     {["UPI", "VISA", "MC", "RUPAY"].map(method => (
                        <div key={method} className="bg-white/5 border border-white/5 rounded-md px-3 py-1 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                           {method}
                        </div>
                     ))}
                  </div>
               </div>
               <div className="shrink-0 flex justify-center items-center w-14 h-14 rounded-full bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                  <Lock className="w-5 h-5 text-zinc-400" />
               </div>
            </div>
          </div>
        </section>

        {/* DESKTOP CTA BUTTON (Hidden on Mobile) */}
        <div className="hidden lg:block pt-8">
           <Button
             size="lg"
             disabled={placing || !selectedAddress}
             onClick={handlePlaceOrder}
             className="w-full h-14 rounded-xl text-base font-bold bg-white text-black hover:bg-gray-200 disabled:bg-[#141416] disabled:text-gray-600 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.98] group"
           >
             {placing ? (
               <>
                 <Loader2 className="w-5 h-5 animate-spin mr-3" />
                 Initiating Secure Payment...
               </>
             ) : (
               <>
                 <Lock className="w-4 h-4 mr-3 shrink-0 opacity-60 group-hover:opacity-100" />
                 Pay Securely <ArrowRight className="ml-3 w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </>
             )}
           </Button>

           {/* Guaranteed Trust Block */}
           <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 flex flex-col items-center gap-3.5 mt-6 relative overflow-hidden group/trust">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full" />
              <div className="flex items-center gap-5 relative z-10">
                 <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4" /> 256-bit SSL
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    <Lock className="w-4 h-4" /> Secure Pay
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    <RotateCcw className="w-4 h-4" /> Easy Returns
                 </div>
              </div>
              <p className="text-[10px] text-zinc-500 text-center font-medium leading-relaxed max-w-xs relative z-10">
                 Trusted by 5,000+ users. Your payment is encrypted and processed via Razorpay. We never store your card details.
              </p>
           </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Order Summary */}
      <div className="lg:col-span-5 relative mt-8 lg:mt-0">
        <div className="lg:sticky lg:top-28 space-y-6">

           <div className="bg-[#141416] shadow-2xl border border-white/10 p-6 lg:p-8 rounded-3xl relative overflow-hidden">
             <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
             
             <h2 className="text-xl font-bold text-white mb-6 hidden lg:block relative z-10">Order Summary</h2>

             <div className="space-y-5 mb-8 relative z-10">
               {items.map((item, index) => (
                 <div key={`${item.id}-${index}`} className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-lg bg-[#0a0a0a] border border-white/10 shrink-0 overflow-hidden flex items-center justify-center relative">
                      {item.images?.[0]?.imageUrl ? (
                         <img src={item.images[0].imageUrl} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                         <Package className="w-4 h-4 text-gray-500" />
                      )}
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-black font-extrabold text-[10px] rounded-full flex items-center justify-center border-2 border-[#141416]">
                         {item.quantity}
                      </div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white line-clamp-1">{item.name}</h4>
                      <div className="text-gray-500 text-xs mt-1 font-medium">₹{(item.price * item.quantity).toFixed(2)}</div>
                   </div>
                 </div>
               ))}
             </div>

             <Separator className="bg-white/10 mb-6" />

             <div className="space-y-4 text-sm relative z-10">
               <div className="flex justify-between text-gray-400 font-medium">
                 <span>Subtotal • {items.length} item{items.length !== 1 && 's'}</span>
                 <span className="text-white">₹{subtotal.toFixed(2)}</span>
               </div>
               <div className="flex justify-between text-gray-400 items-center font-medium">
                 <span>Shipping</span>
                 <span className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Free</span>
               </div>

               {/* Promo code */}
               {!promoCode ? (
                 <div className="flex gap-2 pt-1">
                   <input
                     value={promoInput}
                     onChange={(e) => setPromoInput(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                     placeholder="Promo code"
                     className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
                   />
                   <button
                     onClick={applyPromo}
                     disabled={promoLoading || !promoInput.trim()}
                     className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
                   >
                     {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                   </button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center text-gray-400 font-medium">
                   <span className="flex items-center gap-1.5">
                     Discount
                     <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{promoCode}</span>
                     <button onClick={removePromo} className="text-zinc-600 hover:text-zinc-400 text-xs ml-1">✕</button>
                   </span>
                   <span className="text-emerald-400">−₹{discountAmount.toFixed(2)}</span>
                 </div>
               )}
               
               <Separator className="bg-white/5 my-5" />

               <div className="flex justify-between items-end relative z-10">
                 <span className="text-gray-400 font-medium">Total</span>
                 <span className="text-3xl font-black text-white tracking-tighter">₹{total.toFixed(2)}</span>
               </div>
             </div>

             {/* TRUST BADGES IN SUMMARY */}
             <div className="mt-8 space-y-3 relative z-10">
                <div className="flex items-center gap-3 text-xs text-gray-300 font-medium">
                   <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure encrypted checkout
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300 font-medium">
                   <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 100% money-back guarantee
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-300 font-medium">
                   <Lock className="w-4 h-4 text-emerald-400" /> Bank-grade 256-bit security
                </div>
             </div>

           </div>
        </div>
      </div>
      
      </div> {/* CLOSING MAIN GRID */}

      {/* MOBILE STICKY CTA (Hidden on Desktop) */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] left-0 right-0 z-50 lg:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 p-4 flex justify-between items-center shadow-[0_-20px_40px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col">
           <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Encrypted</span>
           </div>
           <span className="text-2xl font-black text-white leading-none">
             ₹{total.toFixed(2)}
           </span>
        </div>
        <Button
          disabled={placing || !selectedAddress}
          className="bg-white text-black hover:bg-gray-200 font-bold rounded-xl h-12 px-6 active:scale-95 transition-all disabled:bg-[#141416] disabled:text-gray-600 shadow-[0_4px_20px_rgba(255,255,255,0.1)]"
          onClick={handlePlaceOrder}
        >
          {placing ? <Loader2 className="w-5 h-5 animate-spin px-4" /> : <span className="flex items-center gap-2">Pay Securely <ArrowRight className="w-4 h-4" /></span>}
        </Button>
      </div>
    </div>
  );
}
