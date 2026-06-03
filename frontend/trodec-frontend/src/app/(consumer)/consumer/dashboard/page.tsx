"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Package,
  Users,
  Star,
  ArrowRight,
  TrendingUp,
  Loader2,
  ThumbsUp,
  MessageSquare,
  Send,
  Flame,
  CheckCircle2,
  MessagesSquare,
  Compass,
} from "lucide-react";
import { PremiumProductCard, PremiumProductCardSkeleton } from "@/components/product/PremiumProductCard";
import { useRouter } from "next/navigation";
import { getCommunities, getProducts, Community, Product } from "@/services";
import { useAuthStore } from "@/stores/auth.store";
import { useCommunityStore } from "@/stores";
import { PostService, PostWithDetails } from "@/services/post.service";
import {
  PostDiscussion,
  getPostDiscussions,
  createPostDiscussion,
} from "@/services/post_discussion.service";
import { useModalStore } from "@/stores/modal.store";
import { toast } from "sonner";
import { uniqueById } from "@/lib/utils";

// ── helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── DiscussionThread ───────────────────────────────────────────────────────────

function DiscussionThread({ postId }: Readonly<{ postId: string }>) {
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const [discussions, setDiscussions] = useState<PostDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadDiscussions();
  }, [postId]);

  async function loadDiscussions() {
    try {
      setLoading(true);
      const data = await getPostDiscussions(postId);
      setDiscussions(data);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to join the discussion", onComplete: handlePost });
      return;
    }
    if (!newPost.trim()) return;
    try {
      setPosting(true);
      const created = await createPostDiscussion(postId, newPost.trim());
      setDiscussions((prev) => [created, ...prev]);
      setNewPost("");
    } catch {
      toast.error("Failed to post discussion");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-white/5 pt-3 mt-3">
      <div className="flex gap-2">
        <input
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Start a discussion..."
          className="flex-1 bg-white/3 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/40 transition"
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <button
          className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition disabled:opacity-40"
          onClick={handlePost}
          disabled={!newPost.trim() || posting}
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>

      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600 mx-auto" />}

      {!loading && discussions.length === 0 && (
        <p className="text-zinc-600 text-[11px] text-center py-3">No discussions yet</p>
      )}

      {!loading &&
        discussions.map((d) => (
          <div key={d.id} className="bg-white/2 rounded-lg p-2.5 space-y-2 border border-white/4">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                {getInitials(d.author?.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-[11px]">{d.author?.fullName ?? "User"}</span>
                  <span className="text-zinc-600 text-[10px]">{timeAgo(d.createdAt)}</span>
                </div>
                <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">{d.content}</p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

// ── FeedPostCard ───────────────────────────────────────────────────────────────

function FeedPostCard({ post, onLike }: Readonly<{ post: PostWithDetails; onLike: (id: string) => void }>) {
  const router = useRouter();
  const [showDiscussions, setShowDiscussions] = useState(false);

  return (
    <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden hover:border-white/15 transition-colors">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={post.expert?.avatarUrl || `https://ui-avatars.com/api/?name=${post.expert?.fullName || "E"}`}
              alt={post.expert?.fullName || "Expert"}
              className="w-8 h-8 rounded-full border border-white/10 object-cover"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm">{post.expert?.fullName ?? "Expert"}</span>
                {post.community && (
                  <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-30">
                    in {post.community.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-bold text-zinc-400">{post.rating.toFixed(1)}</span>
                <span className="text-[10px] text-zinc-600 ml-1">&bull; {timeAgo(post.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/consumer/products/${post.product?.id || post.productId}`)}
            className="text-[10px] font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded border border-purple-500/20 transition-colors uppercase tracking-wider whitespace-nowrap"
          >
            View Product
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-[13px] font-bold text-white leading-snug">{post.title || post.verdict}</h3>
          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{post.content}</p>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-[#0a0a0c] border-t border-white/5 flex items-center gap-4 text-[11px] font-bold text-zinc-500">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1.5 hover:text-white transition-colors ${post.hasLiked ? "text-purple-400" : ""}`}
        >
          <ThumbsUp className="w-3.5 h-3.5" /> {post.likesCount}
        </button>
        <button
          onClick={() => setShowDiscussions((v) => !v)}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showDiscussions ? "Hide" : "Discuss"}
        </button>
      </div>

      {showDiscussions && (
        <div className="px-4 pb-4 bg-[#0a0a0c]">
          <DiscussionThread postId={post.id} />
        </div>
      )}
    </div>
  );
}

// ── CommunityFeedSection ───────────────────────────────────────────────────────

function CommunityFeedSection({
  isLoading,
  posts,
  suggestedCommunities,
  onLike,
  onNavigate,
}: Readonly<{
  isLoading: boolean;
  posts: PostWithDetails[];
  suggestedCommunities: Community[];
  onLike: (id: string) => void;
  onNavigate: (path: string) => void;
}>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {["s0", "s1"].map((k) => (
            <div key={k} className="h-32 bg-[#0a0a0c] border border-white/10 rounded-xl animate-pulse" />
          ))}
      </div>
    );
  }
  if (posts.length > 0) {
    return (
      <div className="space-y-3">
        {posts.map((post) => (
          <FeedPostCard key={post.id} post={post} onLike={onLike} />
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0c] p-8 text-center space-y-4">
      <MessagesSquare className="w-8 h-8 text-zinc-700 mx-auto" />
      <div>
        <p className="text-white font-semibold text-sm">Your feed is empty</p>
        <p className="text-zinc-500 text-xs mt-1">
          Join communities to see expert reviews and picks in your feed.
        </p>
      </div>
      {suggestedCommunities.length > 0 && (
        <div className="space-y-2 text-left">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Suggested for you</p>
          {suggestedCommunities.map((c) => (
            <button
              key={c.id}
              onClick={() => onNavigate(`/consumer/communities/${c.id}`)}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-white/10 bg-white/3 hover:bg-white/4 hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[12px] font-bold text-white truncate">{c.name}</span>
              </div>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider shrink-0 bg-emerald-500/15 px-2 py-1 rounded">
                Join →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DashboardSidebar ───────────────────────────────────────────────────────────

function DashboardSidebar({
  isLoading,
  joinedCommunitiesData,
  suggestedCommunities,
  joinedCount,
  onNavigate,
}: Readonly<{
  isLoading: boolean;
  joinedCommunitiesData: Community[];
  suggestedCommunities: Community[];
  joinedCount: number;
  onNavigate: (path: string) => void;
}>) {
  return (
    <div className="space-y-6">
      {/* YOUR COMMUNITIES */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-[15px] font-bold text-white tracking-tight">Your Communities</h2>
        </div>
        <div className="bg-[#0a0a0c] border border-white/10 rounded-xl overflow-hidden">
          {isLoading && (
            <div className="p-4 space-y-2 animate-pulse">
              {["s0", "s1", "s2"].map((k) => (
                  <div key={k} className="h-10 bg-white/5 rounded-lg" />
                ))}
            </div>
          )}
          {!isLoading && joinedCommunitiesData.length === 0 && (
            <div className="p-6 text-center space-y-3">
              <p className="text-zinc-500 text-xs">You haven't joined any communities yet.</p>
              <button
                onClick={() => onNavigate("/consumer/communities")}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-2 rounded-lg transition-all"
              >
                Explore Communities <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {!isLoading && joinedCommunitiesData.length > 0 && (
            <div className="divide-y divide-white/5">
              {joinedCommunitiesData.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onNavigate(`/consumer/communities/${c.id}`)}
                  className="w-full flex items-center gap-3 p-3.5 hover:bg-white/2 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-zinc-500">{c.memberCount ?? 0} members</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SUGGESTED FOR YOU */}
      {!isLoading && joinedCount < 3 && suggestedCommunities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h2 className="text-[15px] font-bold text-white tracking-tight">Suggested for You</h2>
          </div>
          <div className="space-y-2">
            {suggestedCommunities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onNavigate(`/consumer/communities/${c.id}`)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-white/10 bg-[#0a0a0c] hover:bg-[#111] hover:border-blue-500/30 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {c.memberCount ?? 0} members &bull; {c.expertCount ?? 0} experts
                  </p>
                </div>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider shrink-0 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                  Join
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, profile } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const { joinedCommunities: joinedCommunityIds, fetchJoinedCommunities } = useCommunityStore();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch joined communities first so the store is populated before products are set
        if (isAuthenticated) await fetchJoinedCommunities();

        const [commResult, postsResult, productsResult] = await Promise.all([
          getCommunities({ limit: 100 }),
          PostService.getPosts({ isPublished: "true", limit: 30, sortBy: "created_at", sortOrder: "desc" }),
          getProducts({ limit: 100 }),
        ]);
        setCommunities(uniqueById(commResult.data));
        setPosts(uniqueById(postsResult.data));
        setProducts(uniqueById(productsResult.data));
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [isAuthenticated, fetchJoinedCommunities]);

  async function handleLikePost(postId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to like this post", onComplete: () => handleLikePost(postId) });
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      const liked = !post.hasLiked;
      await (liked ? PostService.likePost(postId) : PostService.unlikePost(postId));
      const delta = liked ? 1 : -1;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, hasLiked: liked, likesCount: p.likesCount + delta } : p
        )
      );
    } catch {
      toast.error("Failed to update like");
    }
  }

  const joinedCommunitiesData = useMemo(
    () => communities.filter((c) => joinedCommunityIds.includes(c.id)),
    [communities, joinedCommunityIds]
  );

  const suggestedCommunities = useMemo(
    () =>
      [...communities]
        .filter((c) => !joinedCommunityIds.includes(c.id))
        .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
        .slice(0, 3),
    [communities, joinedCommunityIds]
  );

  const communityFeedPosts = useMemo(
    () =>
      posts.filter((p) => p.communityId && joinedCommunityIds.includes(p.communityId)).slice(0, 8),
    [posts, joinedCommunityIds]
  );

  const trendingProducts = useMemo(
    () =>
      [...products]
        .filter((p) =>
          postsMap[p.id] && // only show products with a published review
          (!p.communityId || !joinedCommunityIds.includes(p.communityId))
        )
        .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
        .slice(0, 8),
    [products, joinedCommunityIds, postsMap]
  );

  const postsMap = useMemo(() => {
    const map: Record<string, typeof posts[0]> = {};
    posts.forEach((post) => {
      if (!map[post.productId]) map[post.productId] = post;
    });
    return map;
  }, [posts]);

  const firstName = profile?.fullName?.split(" ")[0] || "there";
  const reviewWord = communityFeedPosts.length === 1 ? "review" : "reviews";
  const communityWord = joinedCommunityIds.length === 1 ? "community" : "communities";
  const hasJoinedCommunities = joinedCommunityIds.length > 0;
  const heroHeading = hasJoinedCommunities
    ? `Your communities are active, ${firstName}`
    : `Welcome back, ${firstName}`;
  const heroSubtext = hasJoinedCommunities
    ? `${communityFeedPosts.length} expert ${reviewWord} across your ${joinedCommunityIds.length} ${communityWord}.`
    : "Join communities to get expert-curated product picks right in your feed.";
  let discoverContent: React.ReactNode;
  if (isLoading) {
    discoverContent = (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
        {["p0", "p1", "p2", "p3"].map((k) => (
          <PremiumProductCardSkeleton key={k} />
        ))}
      </div>
    );
  } else if (trendingProducts.length === 0) {
    discoverContent = (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0c] p-8 text-center space-y-3">
        <Compass className="w-6 h-6 text-zinc-600 mx-auto" />
        <p className="text-zinc-500 text-xs">
          You&apos;ve joined all active communities — you&apos;re all caught up!
        </p>
        <button
          onClick={() => router.push("/consumer/products")}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-4 py-2 rounded-lg transition-all"
        >
          Browse All Products <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  } else {
    discoverContent = (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
        {trendingProducts.map((product) => {
          const productCommunity = product.communityId
            ? communities.find((c) => c.id === product.communityId)
            : null;
          return (
            <PremiumProductCard
              key={product.id}
              product={product}
              expertPost={postsMap[product.id]}
              communityData={productCommunity ? { id: productCommunity.id, name: productCommunity.name } : undefined}
              onCommunityClick={(communityId) => router.push(`/consumer/communities/${communityId}`)}
            />
          );
        })}
      </div>
    );
  }

  const heroCta = hasJoinedCommunities ? (
    <button
      onClick={() => document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" })}
      className="h-10 px-5 text-[13px] font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
    >
      View My Feed
    </button>
  ) : (
    <button
      onClick={() => router.push("/consumer/communities")}
      className="h-10 px-5 text-[13px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
    >
      Explore Communities
    </button>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-300 mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── HERO ── */}
        <div className="bg-[#0a0a0c] rounded-2xl p-6 sm:p-8 border border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-purple-500/10 to-transparent opacity-50 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-[32px] font-black text-white mb-2 tracking-tight">
                {heroHeading}
              </h1>
              <p className="text-zinc-400 text-[13px] sm:text-sm mb-5 font-medium">{heroSubtext}</p>
              <div className="flex flex-wrap items-center gap-3">
                {heroCta}
                <button
                  onClick={() => router.push("/consumer/products")}
                  className="h-10 px-5 text-[13px] font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  Browse Products
                </button>
              </div>
            </div>

            {hasJoinedCommunities && (
              <div className="flex sm:flex-col gap-3 shrink-0">
                <div className="bg-white/3 border border-white/5 rounded-xl px-5 py-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">{joinedCommunityIds.length}</p>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                    Communities
                  </p>
                </div>
                <div className="bg-white/3 border border-white/5 rounded-xl px-5 py-3 text-center">
                  <p className="text-2xl font-black text-purple-400">{communityFeedPosts.length}</p>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                    New Reviews
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-6">

          {/* LEFT */}
          <div className="space-y-8 min-w-0">

            {/* COMMUNITY FEED */}
            <div className="space-y-4" id="feed">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4 text-purple-400" />
                  <h2 className="text-[15px] font-bold text-white tracking-tight">Community Feed</h2>
                </div>
                <button
                  onClick={() => router.push("/consumer/communities")}
                  className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors uppercase tracking-wider"
                >
                  Browse <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <CommunityFeedSection
                isLoading={isLoading}
                posts={communityFeedPosts}
                suggestedCommunities={suggestedCommunities}
                onLike={handleLikePost}
                onNavigate={(path) => router.push(path)}
              />
            </div>

            {/* DISCOVER PRODUCTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-[15px] font-bold text-white tracking-tight">Discover Products</h2>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 ml-6">
                    From communities you haven&apos;t joined yet — don&apos;t miss out!
                  </p>
                </div>
                <button
                  onClick={() => router.push("/consumer/products")}
                  className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors uppercase tracking-wider shrink-0"
                >
                  View All
                </button>
              </div>

              {discoverContent}
            </div>

            {/* DISCOVER COMMUNITIES — appears below the personalised feed */}
            {!isLoading && suggestedCommunities.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-blue-400" />
                      <h2 className="text-[15px] font-bold text-white tracking-tight">Discover Communities</h2>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 ml-6">
                      Other spaces you might like
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/consumer/communities")}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-wider shrink-0"
                  >
                    Browse All
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {suggestedCommunities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => router.push(`/consumer/communities/${c.id}`)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-[#0a0a0c] hover:bg-[#111] hover:border-blue-500/30 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white truncate">{c.name}</p>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                          {c.description || `${c.memberCount ?? 0} members · ${c.expertCount ?? 0} experts`}
                        </p>
                      </div>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider shrink-0 bg-emerald-500/15 px-2 py-1 rounded">
                        Join
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR */}
          <DashboardSidebar
            isLoading={isLoading}
            joinedCommunitiesData={joinedCommunitiesData}
            suggestedCommunities={suggestedCommunities}
            joinedCount={joinedCommunityIds.length}
            onNavigate={(path) => router.push(path)}
          />

        </div>
      </div>
    </div>
  );
}
