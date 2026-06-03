"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import {
  Search,
  ShoppingBag,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getProducts, Product } from "@/services";
import { PostService, PostWithDetails } from "@/services/post.service";
import { useAuthStore, useCommunityStore } from "@/stores";
import { useModalStore } from "@/stores/modal.store";
import { ProductFilters, FilterState } from "@/components/product/product-filters";
import { motion, AnimatePresence } from "framer-motion";
import { PremiumProductCard, PremiumProductCardSkeleton } from "@/components/product/PremiumProductCard";
import { uniqueById } from "@/lib/utils";


const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [postsMap, setPostsMap] = useState<Record<string, PostWithDetails>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState | null>(null);

  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const { joinedCommunities, fetchJoinedCommunities, hasFetched } = useCommunityStore();

  const handleCartClick = () => {
    if (!isAuthenticated) {
      openLoginModal({
        message: "Login to view your cart",
        onComplete: () => router.push("/consumer/cart"),
      });
    } else {
      router.push("/consumer/cart");
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        setIsLoading(true);

        if (isAuthenticated && !hasFetched) {
          await fetchJoinedCommunities();
        }

        if (!controller.signal.aborted) {
          const currentJoined = useCommunityStore.getState().joinedCommunities;
          const [productsResult, postsResult] = await Promise.all([
            getProducts(currentJoined.length > 0 ? { communityIds: currentJoined } : undefined),
            PostService.getPosts({ isPublished: "true", limit: 100, sortBy: "created_at", sortOrder: "desc" }),
          ]);
          if (!controller.signal.aborted) {
            setProducts(uniqueById(productsResult.data as Product[]));
            const map: Record<string, PostWithDetails> = {};
            postsResult.data.forEach((post) => {
              if (!map[post.productId]) map[post.productId] = post;
            });
            setPostsMap(map);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Failed to load products"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => controller.abort();
  }, [isAuthenticated, hasFetched, fetchJoinedCommunities]);

  let filteredProducts = products.filter((p) => {
    // Only surface products that have at least one expert-published post
    if (!postsMap[p.id]) return false;

    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filters) {
      if (filters.category !== "all") {
        const catName = p.category?.name?.toLowerCase() || "";
        if (!catName.includes(filters.category)) return false;
      }

      if (filters.priceRange && filters.priceRange !== "all") {
          const price = p.price;
          if (filters.priceRange === "under-50" && price >= 50) return false;
          if (filters.priceRange === "50-200" && (price < 50 || price > 200)) return false;
          if (filters.priceRange === "200-500" && (price < 200 || price > 500)) return false;
          if (filters.priceRange === "500-plus" && price <= 500) return false;
      }

      if (filters.rating !== "all") {
        if (p.averageRating < Number(filters.rating)) return false;
      }
    }
    return true;
  });

  if (filters?.sortBy) {
    filteredProducts = [...filteredProducts].sort((a, b) => {
      if (filters.sortBy === "price-low") return a.price - b.price;
      if (filters.sortBy === "price-high") return b.price - a.price;
      if (filters.sortBy === "rating") return b.averageRating - a.averageRating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const renderSkeletons = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 auto-rows-fr">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <PremiumProductCardSkeleton key={i} />
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-[1200px] mx-auto">
        <p className="text-red-400">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-white text-black hover:bg-zinc-200 rounded-full px-6"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6 pb-20 pt-4">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1">
            Marketplace
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            Products curated by experts from your communities.
          </p>
        </div>

        <Button
          className="bg-white text-black hover:bg-gray-200 rounded-lg px-6 py-2.5 font-semibold transition-transform hover:scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.1)] flex-shrink-0 h-11"
          onClick={handleCartClick}
        >
          <ShoppingBag className="w-4 h-4 mr-2" />
          My Cart
        </Button>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col gap-4 bg-white/[0.03] backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

        <div className="relative group/search z-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within/search:text-gray-300 transition-colors duration-200" />
          <Input
            placeholder="Search products..."
            className="pl-11 pr-10 h-12 bg-[#0d0d0f] border border-white/10 hover:border-white/20 focus-visible:border-white/30 focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_20px_rgba(255,255,255,0.08)] text-white placeholder:text-gray-500 font-medium text-base rounded-xl transition-all duration-300 shadow-sm w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1 rounded-full transition-colors"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 w-full overflow-x-auto z-10">
          <ProductFilters onFilterChange={setFilters} />
        </div>
      </div>

      {/* MAIN GRID */}
      {isLoading ? renderSkeletons() : filteredProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-6 bg-[#0a0a0a] rounded-2xl border border-white/10"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-gray-500" />
            </div>

            {joinedCommunities.length === 0 ? (
                <>
                    <h3 className="text-lg font-bold text-white mb-1.5">
                      Join communities to unlock products
                    </h3>
                    <p className="text-gray-400 text-sm text-center max-w-sm mb-6">
                      Products are curated by community experts. Join a community to browse their picks.
                    </p>
                    <Button
                      onClick={() => router.push("/consumer/communities")}
                      className="bg-white text-black font-bold px-8 hover:bg-zinc-200 rounded-xl"
                    >
                      Explore Communities
                    </Button>
                </>
            ) : (
                <>
                    <h3 className="text-lg font-bold text-white mb-1.5">
                      {products.length === 0
                        ? "No products in your communities yet"
                        : Object.keys(postsMap).length === 0
                          ? "No expert reviews published yet"
                          : "No products match your filters"}
                    </h3>
                    <p className="text-gray-400 text-sm text-center max-w-sm mb-6">
                      {products.length === 0
                        ? "The communities you joined don't have listed products yet."
                        : Object.keys(postsMap).length === 0
                          ? "Products appear here once an expert in your communities publishes a review."
                          : "Try adjusting your search or filters to see more results."}
                    </p>
                    {(searchQuery || filters) && (
                      <Button
                        onClick={() => setSearchQuery("")}
                        variant="ghost"
                        className="rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
                      >
                        Clear Search
                      </Button>
                    )}
                </>
            )}
          </motion.div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 auto-rows-fr"
        >
          <AnimatePresence>
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                variants={itemVariants}
                layout
                className="h-full"
              >
                <PremiumProductCard
                  product={product}
                  expertPost={postsMap[product.id]}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
