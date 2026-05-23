"use client";

import { useRouter } from "next/navigation";
import { Star, Package, TrendingUp, Flame, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { Product } from "@/services";
import { PostWithDetails } from "@/services/post.service";

interface PremiumProductCardProps {
  product: Product;
  expertPost?: PostWithDetails;
  communityData?: { id: string; name: string };
  onCommunityClick?: (communityId: string) => void;
  className?: string;
}

export function PremiumProductCard({
  product,
  expertPost,
  communityData,
  onCommunityClick,
  className = "",
}: PremiumProductCardProps) {
  const router = useRouter();
  const hasImage = !!product.images?.[0]?.imageUrl;

  return (
    <div
      className={`group relative overflow-hidden transition-all duration-300 rounded-xl cursor-pointer hover:-translate-y-1 flex flex-col w-full bg-[#0f0f10] border border-white/10 hover:border-white/20 shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 z-10 ${className}`}
      onClick={() => router.push(`/consumer/products/${product.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full p-2 overflow-hidden shrink-0 bg-[#0a0a0a]">
        <div className="w-full h-full relative rounded-lg overflow-hidden bg-white skeleton">
          {hasImage && product.images ? (
            <img
              src={product.images[0].imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 opacity-0"
              onLoad={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.classList.remove("opacity-0");
                img.classList.add("opacity-100");
                (img.parentElement as HTMLElement).classList.remove("skeleton");
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#0a0a0a] to-[#0f0f10]">
              <Package className="w-10 h-10 mb-2 text-gray-700" />
            </div>
          )}

          {/* Top-left: Trending / Popular badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isFeatured && (
              <div className="flex items-center gap-1.5 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/20">
                <TrendingUp className="w-3 h-3" />
                Trending
              </div>
            )}
            {product.reviewCount > 100 && (
              <div className="flex items-center gap-1.5 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border bg-orange-500/10 text-orange-400 border-orange-500/20">
                <Flame className="w-3 h-3" />
                Popular
              </div>
            )}
          </div>

          {/* Top-right: Tested by Expert badge */}
          {expertPost && (
            <div className="absolute top-3 right-3 flex items-center gap-1 backdrop-blur-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-md shadow-lg">
              <ShieldCheck className="w-3 h-3" />
              <span className="hidden sm:inline">Tested</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 flex flex-col flex-grow relative z-10 transition-colors bg-transparent group-hover:bg-[#141416]">
        {/* Brand + Category */}
        <div className="flex items-center gap-1.5 mb-1 min-w-0">
          {product.brand?.brandName && (
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">
              {product.brand.brandName}
            </span>
          )}
          {product.brand?.brandName && product.category?.name && (
            <span className="text-zinc-700 text-[9px] shrink-0">·</span>
          )}
          {product.category?.name && (
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-600 truncate">
              {product.category.name}
            </span>
          )}
        </div>

        {/* Product Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-white mb-2">
          {product.name}
        </h3>

        {/* Expert + Community attribution */}
        {expertPost?.expert?.fullName && (
          <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
            <img
              src={
                expertPost.expert.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(expertPost.expert.fullName)}&size=24`
              }
              alt={expertPost.expert.fullName}
              loading="lazy"
              decoding="async"
              className="w-4 h-4 rounded-full border border-white/10 shrink-0 object-cover overflow-hidden"
            />
            <span className="text-[10px] font-semibold text-purple-400 truncate">
              {expertPost.expert.fullName}
            </span>
            {expertPost.community && (
              <span className="text-[10px] text-zinc-500 shrink-0 truncate max-w-[80px]">
                · {expertPost.community.name}
              </span>
            )}
          </div>
        )}

        {/* Expert Verdict */}
        {(expertPost?.verdict || expertPost?.content) && (
          <p className="text-[10px] text-zinc-400 italic leading-relaxed line-clamp-2 mb-2 pl-2 border-l-2 border-purple-500/30">
            &ldquo;{expertPost.verdict || expertPost.content}&rdquo;
          </p>
        )}

        {/* Rating */}
        {product.averageRating > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3 h-3 ${
                    s <= Math.round(product.averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-zinc-700"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-zinc-500">({product.reviewCount})</span>
          </div>
        )}

        <div className="flex-grow" />

        {/* Price */}
        <div className="flex items-center justify-between mt-1.5 mb-2">
          <div className="text-lg font-black tracking-tight text-white">
            ₹{product.price.toFixed(2)}
          </div>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-xs text-zinc-500 line-through">
              ₹{product.compareAtPrice.toFixed(2)}
            </span>
          )}
        </div>

        <Button
          className="w-full text-xs font-bold h-9 rounded-lg transition-all active:scale-95 bg-white text-black hover:bg-gray-200"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/consumer/products/${product.id}`);
          }}
        >
          View Product
        </Button>
      </div>

      {/* Optional Community Join CTA */}
      {communityData && onCommunityClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCommunityClick(communityData.id);
          }}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-500/5 border-t border-emerald-500/15 hover:bg-emerald-500/10 transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-bold text-emerald-400 truncate">
              {communityData.name}
            </span>
          </div>
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider shrink-0 bg-emerald-500/20 px-1.5 py-0.5 rounded">
            Join →
          </span>
        </button>
      )}
    </div>
  );
}

export function PremiumProductCardSkeleton() {
  return (
    <div className="bg-[#0f0f10] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-2 bg-[#0a0a0a]">
        <div className="w-full aspect-square rounded-lg skeleton shimmer" />
      </div>
      <div className="p-3 md:p-4 flex flex-col flex-grow space-y-3">
        <div className="h-3 w-1/3 skeleton rounded" />
        <div className="h-5 w-3/4 skeleton rounded" />
        <div className="h-3 w-1/2 skeleton rounded" />
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex justify-between items-center">
            <div className="h-6 w-16 skeleton rounded" />
            <div className="h-4 w-12 skeleton rounded" />
          </div>
          <div className="h-9 w-full skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}
