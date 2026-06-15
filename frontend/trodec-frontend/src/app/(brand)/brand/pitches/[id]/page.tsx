"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Package,
  Users,
  Calendar,
  Truck,
  MapPin,
  RefreshCw,
  ImageIcon,
  Info,
  ChevronLeft,
  ChevronRight,
  User,
  Download,
} from "lucide-react";
import { ProductAttributesCard } from "@/components/product/ProductAttributesCard";
import { toast } from "sonner";
import {
  getPitch,
  PitchWithDetails,
  getPitchStatusColor,
  getPitchStatusLabel,
} from "@/services";
import {
  getPitchShipment,
  refreshShipmentLabel,
  getShipmentStatusColor,
  getShipmentStatusLabel,
  PitchShipment,
} from "@/services/shipment.service";

export default function BrandPitchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pitch, setPitch] = useState<PitchWithDetails | null>(null);
  const [shipment, setShipment] = useState<PitchShipment | null>(null);
  const [pitchLoading, setPitchLoading] = useState(true);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [generatingLabel, setGeneratingLabel] = useState(false);

  useEffect(() => {
    loadPitch();
  }, [id]);

  async function loadPitch() {
    try {
      setPitchLoading(true);
      const data = await getPitch(id);
      setPitch(data);
      if (
        data.status === "accepted" ||
        data.status === "shipped" ||
        data.status === "delivered" ||
        data.status === "posted" ||
        data.status === "completed"
      ) {
        loadShipment();
      }
    } catch {
      toast.error("Failed to load pitch");
      router.push("/brand/pitches");
    } finally {
      setPitchLoading(false);
    }
  }

  async function loadShipment() {
    setShipmentLoading(true);
    setShipmentError(null);
    try {
      const data = await getPitchShipment(id);
      setShipment(data);
    } catch (err: any) {
      setShipmentError(err.message ?? "Shipment not created yet");
    } finally {
      setShipmentLoading(false);
    }
  }

  if (pitchLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!pitch) return null;

  const product = pitch.product;
  const images = product?.images ?? [];
  const primaryImage = images.find((img) => img.isPrimary) ?? images[0] ?? null;
  const activeImage = images[selectedImageIdx] ?? primaryImage;

  const hasDiscount =
    product?.compareAtPrice !== null &&
    product?.compareAtPrice !== undefined &&
    product.compareAtPrice > product.price;

  const discountPct = hasDiscount
    ? Math.round((1 - product!.price / product!.compareAtPrice!) * 100)
    : 0;

  const showShipmentSection =
    pitch.status === "accepted" ||
    pitch.status === "shipped" ||
    pitch.status === "delivered" ||
    pitch.status === "posted" ||
    pitch.status === "completed";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-white space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pitch Details</h1>
          <p className="text-sm text-zinc-400">Track your pitch and sample shipment</p>
        </div>
      </div>

      {/* Product Hero */}
      {product && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f] overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">

              {/* Image gallery */}
              <div className="md:w-80 shrink-0 bg-[#111] flex flex-col">
                <div className="relative aspect-square w-full bg-[#111] flex items-center justify-center overflow-hidden">
                  {activeImage ? (
                    <Image
                      src={activeImage.imageUrl}
                      alt={activeImage.altText ?? product.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 320px"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-600">
                      <ImageIcon className="h-12 w-12" />
                      <span className="text-xs">No image</span>
                    </div>
                  )}

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setSelectedImageIdx((i) =>
                            i === 0 ? images.length - 1 : i - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition"
                      >
                        <ChevronLeft className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={() =>
                          setSelectedImageIdx((i) =>
                            i === images.length - 1 ? 0 : i + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition"
                      >
                        <ChevronRight className="h-4 w-4 text-white" />
                      </button>
                    </>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex gap-1.5 p-2 overflow-x-auto flex-wrap">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImageIdx(idx)}
                        className={`relative w-12 h-12 rounded border-2 overflow-hidden shrink-0 transition ${
                          idx === selectedImageIdx
                            ? "border-emerald-500"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={img.imageUrl}
                          alt={img.altText ?? ""}
                          fill
                          className="object-contain"
                          sizes="48px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    {product.category && (
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">
                        {product.category.name}
                      </p>
                    )}
                    <h2 className="text-xl font-semibold leading-tight text-white">
                      {product.name}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize shrink-0 ${getPitchStatusColor(pitch.status)}`}
                  >
                    {getPitchStatusLabel(pitch.status)}
                  </Badge>
                </div>

                {/* Price */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-emerald-400">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-sm text-zinc-500 line-through">
                        ₹{product.compareAtPrice!.toLocaleString("en-IN")}
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {discountPct}% off
                      </Badge>
                    </>
                  )}
                </div>

                {product.shortDescription && (
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {product.shortDescription}
                  </p>
                )}

                {product.sku && (
                  <p className="text-xs text-zinc-600">SKU: {product.sku}</p>
                )}

                <Separator className="bg-[#1f1f1f]" />

                {/* Pitch meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {pitch.community && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">{pitch.community.name}</span>
                    </div>
                  )}
                  {pitch.expert && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {(pitch.expert as any).fullName ?? "Expert"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      {new Date(pitch.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {pitch.postingDeadline && (
                    <div className="flex items-center gap-2 text-yellow-500">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>
                        Deadline:{" "}
                        {new Date(pitch.postingDeadline).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback when no product */}
      {!product && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardContent className="p-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-white">Product Pitch</p>
                <p className="text-xs text-zinc-500">Product details unavailable</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`capitalize ${getPitchStatusColor(pitch.status)}`}
            >
              {getPitchStatusLabel(pitch.status)}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Full Description */}
      {product?.description && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium flex items-center gap-2">
              <Info className="h-4 w-4" /> Product Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Specifications / Attributes */}
      {product?.metadata && (
        <ProductAttributesCard metadata={product.metadata} />
      )}

      {/* Selected Size */}
      {pitch.selectedSize && (
        <Card className="bg-[#0b0b0b] border border-purple-500/20">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <span className="text-purple-400 text-xs font-black">SIZE</span>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Sample size to ship</p>
              <p className="text-white font-bold text-lg">{pitch.selectedSize}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Message */}
      {pitch.message && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Your Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Expert's Response */}
      {pitch.expertResponse && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Expert's Response</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.expertResponse}</p>
          </CardContent>
        </Card>
      )}

      {/* Sample Shipment Tracking */}
      {showShipmentSection && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm text-zinc-400 font-medium">Sample Shipment</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadShipment}
              disabled={shipmentLoading}
              className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${shipmentLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {shipmentLoading ? (
              <div className="flex items-center gap-2 text-zinc-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading shipment...</span>
              </div>
            ) : shipmentError ? (
              <p className="text-sm text-zinc-500">{shipmentError}</p>
            ) : shipment ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getShipmentStatusColor(shipment.status)}`}
                  >
                    {getShipmentStatusLabel(shipment.status)}
                  </Badge>
                  <span className="text-xs text-zinc-500">{shipment.carrier}</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Tracking ID</span>
                    <span className="text-white font-mono text-xs">
                      {shipment.awbCode ?? shipment.trackingId}
                    </span>
                  </div>
                  {shipment.labelUrl && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Shipping Label</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                        onClick={() => window.open(shipment.labelUrl!, "_blank")}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download Label
                      </Button>
                    </div>
                  )}
                  {!shipment.labelUrl && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Shipping Label</span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={generatingLabel}
                        className="h-7 px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                        onClick={async () => {
                          setGeneratingLabel(true);
                          try {
                            const url = await refreshShipmentLabel(shipment.id);
                            setShipment((prev) => prev ? { ...prev, labelUrl: url } : prev);
                            toast.success("Label generated successfully");
                          } catch (err: any) {
                            toast.error(err?.message || "Label not ready — try again shortly");
                          } finally {
                            setGeneratingLabel(false);
                          }
                        }}
                      >
                        {generatingLabel ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5 mr-1" />
                        )}
                        {generatingLabel ? "Fetching..." : "Get Label"}
                      </Button>
                    </div>
                  )}
                  {shipment.shippedAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Shipped</span>
                      <span className="text-white">
                        {new Date(shipment.shippedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {shipment.deliveredAt && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Delivered</span>
                      <span className="text-emerald-400">
                        {new Date(shipment.deliveredAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {shipment.liveTracking && (
                  <div className="border-t border-white/5 pt-3 space-y-1">
                    {shipment.liveTracking.currentLocation && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{shipment.liveTracking.currentLocation}</span>
                      </div>
                    )}
                    {shipment.liveTracking.lastUpdated && (
                      <p className="text-xs text-zinc-600">
                        Updated {shipment.liveTracking.lastUpdated}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
