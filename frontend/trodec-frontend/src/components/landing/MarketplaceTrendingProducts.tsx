import { FC } from "react";
import { Button } from "@/components/ui/button";
import { Star, ArrowRight, BadgeCheck, Zap, ShieldCheck, TrendingUp, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useModalStore } from "@/stores/modal.store";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  rating: number;
  reviews: number;
  category: string;
  brand?: string;
  image: string;
  expert: {
    name: string;
    avatar: string;
    community?: string;
  };
  verdict?: string;
  isTrending?: boolean;
}

const mockTrending: ProductCardProps[] = [
  {
    id: "prod_1",
    name: "Aura Premium Wireless Audio",
    price: 349.99,
    rating: 4.9,
    reviews: 1240,
    category: "Audio",
    brand: "Aura Labs",
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800&auto=format&fit=crop",
    expert: { name: "Sarah Jenkins", avatar: "https://i.pravatar.cc/100?img=47", community: "AudioPhiles Pro" },
    verdict: "Best-in-class noise cancellation with exceptional battery life. A clear buy for serious listeners.",
    isTrending: true,
  },
  {
    id: "prod_2",
    name: "Nexus Mechanical Series",
    price: 189.0,
    rating: 4.8,
    reviews: 892,
    category: "Accessories",
    brand: "Nexus Tech",
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=800&auto=format&fit=crop",
    expert: { name: "Marcus Chen", avatar: "https://i.pravatar.cc/100?img=11", community: "Dev Setup Guild" },
    verdict: "Tactile switches and aluminum build make this the gold standard for daily coding sessions.",
  },
  {
    id: "prod_3",
    name: "Lumina Studio 4K Camera",
    price: 249.5,
    rating: 4.7,
    reviews: 456,
    category: "Video",
    brand: "Lumina",
    image: "https://images.unsplash.com/photo-1517404215738-15263e9f9178?q=80&w=800&auto=format&fit=crop",
    expert: { name: "Elena Rodriguez", avatar: "https://i.pravatar.cc/100?img=32", community: "Creators Circle" },
    verdict: "Sharp 4K with auto white balance that actually works. My first recommendation for streamers.",
  },
  {
    id: "prod_4",
    name: "Aero Mesh Ultra-Light",
    price: 129.99,
    rating: 4.9,
    reviews: 2150,
    category: "Gaming",
    brand: "AeroGear",
    image: "https://images.unsplash.com/photo-1527814050087-379381547969?q=80&w=800&auto=format&fit=crop",
    expert: { name: "David Kim", avatar: "https://i.pravatar.cc/100?img=15", community: "FPS Masters" },
    verdict: "At 61g it is the lightest competitive mouse I've tested — zero fatigue across marathon sessions.",
    isTrending: true,
  },
];

interface MarketplaceTrendingProductsProps {
  title?: string;
  subtitle?: string;
  products?: ProductCardProps[];
  isRecommended?: boolean;
}

export const MarketplaceTrendingProducts: FC<MarketplaceTrendingProductsProps> = ({
  title = "Trending Products",
  subtitle = "Discover what the community loves right now",
  products = mockTrending,
  isRecommended = false,
}) => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useModalStore();

  const handleProductClick = (_id: string) => {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to explore products" });
      return;
    }
    router.push(`/consumer/products`);
  };

  return (
    <section className="py-24 relative z-10 w-full overflow-hidden bg-[#0a0a0a]">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              {title}
            </h2>
            <p className="text-zinc-400 text-lg font-light tracking-wide leading-relaxed">
              {subtitle}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push('/consumer/products')}
            className="text-zinc-400 hover:text-white hidden md:flex items-center gap-2 hover:bg-white/5 rounded-full px-6 py-2 text-sm font-semibold tracking-wide transition-all duration-300 border border-transparent hover:border-white/10"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Grid / Horizontal Scroll on Mobile */}
        <div className="flex overflow-x-auto pb-10 -mx-6 px-6 snap-x snap-mandatory lg:overflow-x-visible lg:pb-0 lg:mx-0 lg:px-0 hide-scrollbar lg:grid lg:grid-cols-4 gap-6">
          {products.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleProductClick(product.id)}
              className="group relative flex-none w-[280px] snap-center lg:w-auto flex flex-col rounded-xl overflow-hidden cursor-pointer bg-[#0f0f10] border border-white/10 hover:border-white/20 shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-300 hover:-translate-y-1 z-10"
            >
              {/* Image */}
              <div className="relative aspect-square w-full p-2 overflow-hidden shrink-0 bg-[#0a0a0a]">
                <div className="w-full h-full relative rounded-lg overflow-hidden bg-[#050505]">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#0a0a0a] to-[#0f0f10]">
                      <Package className="w-10 h-10 mb-2 text-gray-700" />
                    </div>
                  )}

                  {/* Top-left badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
                    {product.isTrending && (
                      <div className="flex items-center gap-1.5 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/20">
                        <TrendingUp className="w-3 h-3" />
                        Trending
                      </div>
                    )}
                    {product.rating >= 4.9 && (
                      <div className="flex items-center gap-1.5 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border bg-orange-500/10 text-orange-400 border-orange-500/20">
                        <Zap className="w-3 h-3" />
                        Popular
                      </div>
                    )}
                    {isRecommended && (
                      <div className="flex items-center gap-1.5 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Recommended
                      </div>
                    )}
                  </div>

                  {/* Top-right: Tested by Expert */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1 backdrop-blur-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-md shadow-lg">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="hidden sm:inline">Tested</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3 md:p-4 flex flex-col flex-grow relative z-10 transition-colors bg-transparent group-hover:bg-[#141416]">
                {/* Brand + Category */}
                <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                  {product.brand && (
                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate">
                      {product.brand}
                    </span>
                  )}
                  {product.brand && (
                    <span className="text-zinc-700 text-[9px] shrink-0">·</span>
                  )}
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-600 truncate">
                    {product.category}
                  </span>
                </div>

                {/* Product Title */}
                <h3 className="font-semibold text-sm md:text-base leading-tight line-clamp-1 md:line-clamp-2 text-white mb-2.5">
                  {product.name}
                </h3>

                {/* Expert + Community */}
                <div className="flex items-center gap-1.5 mb-2 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={product.expert.avatar}
                      alt={product.expert.name}
                      className="w-4 h-4 rounded-full border border-white/10 object-cover"
                    />
                    <BadgeCheck className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-blue-400 bg-[#0f0f10] rounded-full" />
                  </div>
                  <span className="text-[10px] font-semibold text-purple-400 truncate">
                    {product.expert.name}
                  </span>
                  {product.expert.community && (
                    <span className="text-[10px] text-zinc-500 shrink-0 truncate max-w-[80px]">
                      · {product.expert.community}
                    </span>
                  )}
                </div>

                {/* Expert Verdict */}
                {product.verdict && (
                  <p className="text-[10px] md:text-[11px] text-zinc-400 italic leading-relaxed line-clamp-2 mb-2.5 pl-2 border-l-2 border-purple-500/30">
                    &ldquo;{product.verdict}&rdquo;
                  </p>
                )}

                {/* Rating */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${s <= Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "text-zinc-700"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500">({product.reviews.toLocaleString()})</span>
                </div>

                <div className="flex-grow" />

                {/* Price */}
                <div className="flex items-center justify-between mt-2 mb-3">
                  <div className="text-lg font-black tracking-tight text-white">
                    ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <Button
                  className="w-full text-xs font-bold h-9 rounded-lg transition-all active:scale-95 bg-white text-black hover:bg-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProductClick(product.id);
                  }}
                >
                  View Product
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};