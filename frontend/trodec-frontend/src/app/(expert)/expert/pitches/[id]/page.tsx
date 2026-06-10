"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Users,
  Calendar,
  Check,
  X,
  Package,
  ImageIcon,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { ProductAttributesCard } from "@/components/product/ProductAttributesCard";
import { toast } from "sonner";
import {
  getPitch,
  respondToPitch,
  PitchWithDetails,
  getPitchStatusColor,
  getPitchStatusLabel,
} from "@/services";

export default function ExpertPitchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pitch, setPitch] = useState<PitchWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [expertResponse, setExpertResponse] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  useEffect(() => {
    loadPitch();
  }, [id]);

  async function loadPitch() {
    try {
      setIsLoading(true);
      const data = await getPitch(id);
      setPitch(data);
    } catch (error: any) {
      toast.error("Failed to load pitch");
      router.push("/expert/pitches");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept() {
    try {
      setResponding(true);
      await respondToPitch(id, "accepted", expertResponse || undefined, selectedSize || undefined);
      toast.success("Pitch accepted!");
      loadPitch();
    } catch (error: any) {
      toast.error(error.message || "Failed to accept pitch");
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    try {
      setResponding(true);
      await respondToPitch(id, "declined", expertResponse || undefined);
      toast.success("Pitch declined");
      loadPitch();
    } catch (error: any) {
      toast.error(error.message || "Failed to decline pitch");
    } finally {
      setResponding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!pitch) return null;

  const product = pitch.product;
  const brand = (pitch as any).brand;
  const images = product?.images ?? [];
  const primaryImage =
    images.find((img) => img.isPrimary) ?? images[0] ?? null;
  const activeImage = images[selectedImageIdx] ?? primaryImage;

  const hasDiscount =
    product?.compareAtPrice !== null &&
    product?.compareAtPrice !== undefined &&
    product.compareAtPrice > product.price;

  const discountPct = hasDiscount
    ? Math.round(
        (1 - product!.price / product!.compareAtPrice!) * 100
      )
    : 0;

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
          <p className="text-sm text-zinc-400">Review the brand's proposal</p>
        </div>
      </div>

      {/* ─── Product Hero ─── */}
      {product && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f] overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">

              {/* Image gallery */}
              <div className="md:w-80 shrink-0 bg-[#111] flex flex-col">
                {/* Main image */}
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

                  {/* Prev/Next only when multiple images */}
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

                {/* Thumbnail strip */}
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
                          className="object-cover"
                          sizes="48px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="flex-1 p-6 space-y-4">
                {/* Status badge */}
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
                    {brand && (
                      <p className="text-sm text-zinc-400">by {brand.brandName}</p>
                    )}
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

                {/* Short description */}
                {product.shortDescription && (
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {product.shortDescription}
                  </p>
                )}

                {/* SKU */}
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

      {/* Fallback hero when no product join */}
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

      {/* ─── Full Description ─── */}
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

      {/* ─── Specifications / Attributes ─── */}
      {product?.metadata && (
        <ProductAttributesCard metadata={product.metadata} />
      )}

      {/* ─── Selected Size ─── */}
      {pitch.selectedSize && (
        <Card className="bg-[#0b0b0b] border border-purple-500/20">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <span className="text-purple-400 text-xs font-black">SIZE</span>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Brand is sending this size</p>
              <p className="text-white font-bold text-lg">{pitch.selectedSize}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Brand's Pitch Message ─── */}
      {pitch.message && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">
              Message from Brand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.message}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Offer Details ─── */}
      {pitch.offerDetails && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">
              Offer Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.offerDetails}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Requirements ─── */}
      {pitch.requirements && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.requirements}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Expert's previous response ─── */}
      {pitch.expertResponse && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">
              Your Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white leading-relaxed">{pitch.expertResponse}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Publish Review (only if delivered) ─── */}
      {pitch.status === "delivered" && (
        <Card className="bg-[#0b0b0b] border border-emerald-500/20">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm mb-1">Product received — ready to publish</p>
                <p className="text-zinc-400 text-xs mb-4">
                  You've confirmed receipt of this product. Create your expert review post and share it with your community.
                </p>
                <Button
                  onClick={() => router.push(`/expert/posts/new?pitchId=${pitch.id}&productId=${product?.id ?? ""}`)}
                  className="bg-emerald-600 hover:bg-emerald-500 font-semibold"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Write Review Post
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Accept / Decline (only if pending) ─── */}
      {pitch.status === "pending" && (
        <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">
              Respond to this Pitch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const sizesRaw = product?.metadata?.attributes?.sizes ?? product?.metadata?.sizes ?? [];
              const availableSizes: string[] = Array.isArray(sizesRaw)
                ? sizesRaw
                : typeof sizesRaw === "string" && sizesRaw
                  ? sizesRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
                  : [];
              if (availableSizes.length === 0) return null;
              return (
                <div>
                  <label className="text-sm text-zinc-400 mb-1.5 block">Select your size</label>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="w-full bg-[#111111] border border-[#1f1f1f] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">Pick your size (optional)</option>
                    {availableSizes.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
            <Textarea
              placeholder="Optional: add a message with your response..."
              value={expertResponse}
              onChange={(e) => setExpertResponse(e.target.value)}
              className="bg-[#111111] border border-[#1f1f1f] text-white min-h-[80px]"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleAccept}
                disabled={responding}
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
              >
                {responding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept Pitch
              </Button>
              <Button
                onClick={handleDecline}
                disabled={responding}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
