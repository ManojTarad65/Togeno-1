"use client";

import { FC, use, useEffect, useState } from "react";
import {
  Button,
} from "@/components/ui";
import {
  Users,
  MessageSquare,
  Plus,
  Share2,
  Loader2,
  LogOut,
  ThumbsUp,
  Send,
  ChevronDown,
  ChevronUp,
  Star,
  ShoppingBag,
  Package,
  CheckCircle2,
  ShieldCheck,
  RefreshCcw,
  Flame,
  AlertTriangle,
} from "lucide-react";
import {
  getCommunityById,
  getCommunityMembers,
  getProducts,
  Community,
  Product,
} from "@/services";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PostService, PostWithDetails } from "@/services/post.service";
import {
  PostDiscussion,
  getPostDiscussions,
  createPostDiscussion,
  togglePostDiscussionLike,
  createPostDiscussionReply,
  togglePostDiscussionReplyLike,
} from "@/services/post_discussion.service";
import { useAuthStore } from "@/stores/auth.store";
import { useModalStore } from "@/stores/modal.store";
import { useCommunityStore } from "@/stores";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function updateReplyLike(
  d: PostDiscussion,
  discussionId: string,
  replyId: string,
  result: { liked: boolean; likesCount: number }
) {
  if (d.id !== discussionId) return d;
  const replies = (d.replies ?? []).map((r) =>
    r.id === replyId
      ? { ...r, likesCount: result.likesCount, likedByMe: result.liked }
      : r
  );
  return { ...d, replies };
}

// ── Loaders ───────────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.05]" />
        <div className="space-y-2">
          <div className="h-3 bg-white/[0.05] rounded-md w-24" />
          <div className="h-2 bg-white/[0.05] rounded-md w-16" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-white/[0.05] rounded-md w-full" />
        <div className="h-3 bg-white/[0.05] rounded-md w-5/6" />
        <div className="h-3 bg-white/[0.05] rounded-md w-4/6" />
      </div>
    </div>
  );
}

// ── DiscussionThread (inside PostCard) ────────────────────────────────────────

function DiscussionThread({ postId }: Readonly<{ postId: string }>) {
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const [discussions, setDiscussions] = useState<PostDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyPosting, setReplyPosting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDiscussions();
  }, [postId]);

  async function loadDiscussions() {
    try {
      setLoading(true);
      const data = await getPostDiscussions(postId);
      setDiscussions(data);
      const expanded: Record<string, boolean> = {};
      data.forEach((d) => {
        if ((d.replies?.length ?? 0) > 0) expanded[d.id] = true;
      });
      setShowReplies((prev) => ({ ...prev, ...expanded }));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to post a discussion", onComplete: handlePost });
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

  async function handleToggleLike(discussionId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to like this discussion", onComplete: () => handleToggleLike(discussionId) });
      return;
    }
    try {
      const result = await togglePostDiscussionLike(postId, discussionId);
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? { ...d, likesCount: result.likesCount, likedByMe: result.liked }
            : d
        )
      );
    } catch {
      toast.error("Failed to update like");
    }
  }

  async function handlePostReply(discussionId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to reply", onComplete: () => handlePostReply(discussionId) });
      return;
    }
    const text = replyText[discussionId]?.trim();
    if (!text) return;
    try {
      setReplyPosting((prev) => ({ ...prev, [discussionId]: true }));
      const reply = await createPostDiscussionReply(postId, discussionId, text);
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? { ...d, replies: [...(d.replies ?? []), reply] }
            : d
        )
      );
      setReplyText((prev) => ({ ...prev, [discussionId]: "" }));
      setShowReplies((prev) => ({ ...prev, [discussionId]: true }));
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setReplyPosting((prev) => ({ ...prev, [discussionId]: false }));
    }
  }

  async function handleToggleReplyLike(discussionId: string, replyId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to like this reply", onComplete: () => handleToggleReplyLike(discussionId, replyId) });
      return;
    }
    try {
      const result = await togglePostDiscussionReplyLike(postId, replyId);
      setDiscussions((prev) =>
        prev.map((d) => updateReplyLike(d, discussionId, replyId, result))
      );
    } catch {
      toast.error("Failed to update like");
    }
  }

  return (
    <div className="space-y-4 border-t border-white/[0.06] pt-4 mt-2">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <MessageSquare className="w-4 h-4" />
        <span>Discussions ({discussions.length})</span>
      </div>

      <div className="flex gap-2">
        <input
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Share your thoughts..."
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-400 hover:text-white bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08]"
          onClick={handlePost}
          disabled={!newPost.trim() || posting}
        >
          {posting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500 mx-auto" />
      )}

      {!loading && discussions.length === 0 && (
        <p className="text-zinc-600 text-xs text-center py-2">
          No discussions yet — be the first!
        </p>
      )}

      {!loading && discussions.map((d) => {
        const replies = d.replies ?? [];
        const repliesOpen = showReplies[d.id] ?? false;
        const isReplyOpen = replyOpen[d.id] ?? false;
        const isExpertAuthor = d.author?.role === "expert" || d.author?.role === "admin";

        return (
          <div key={d.id} className="bg-[#111] border border-white/[0.06] rounded-xl p-4 space-y-3 hover:border-white/[0.1] transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/[0.1] flex items-center justify-center text-xs font-bold shrink-0 text-white">
                {getInitials(d.author?.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">
                    {d.author?.fullName ?? "User"}
                  </span>
                  {isExpertAuthor && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Expert
                    </span>
                  )}
                  <span className="text-zinc-500 text-xs">{timeAgo(d.createdAt)}</span>
                </div>
                <p className="text-zinc-300 text-sm mt-1 leading-relaxed">{d.content}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 ml-11 flex-wrap">
              <button
                onClick={() => handleToggleLike(d.id)}
                className={`flex items-center gap-1.5 hover:text-white transition font-medium ${d.likedByMe ? "text-purple-400" : ""}`}
              >
                <ThumbsUp className="w-3 h-3" />
                {d.likesCount} {d.likesCount === 1 ? "Like" : "Likes"}
              </button>
              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies((prev) => ({ ...prev, [d.id]: !prev[d.id] }))}
                  className="flex items-center gap-1.5 hover:text-white transition font-medium"
                >
                  {repliesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                </button>
              )}
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal({ message: "Login to reply", onComplete: () => setReplyOpen(prev => ({ ...prev, [d.id]: true })) });
                    return;
                  }
                  setReplyOpen((prev) => ({ ...prev, [d.id]: !prev[d.id] }));
                }}
                className={`flex items-center gap-1.5 font-bold transition px-2.5 py-1 rounded-lg border ${
                  isReplyOpen
                    ? "text-purple-300 bg-purple-500/15 border-purple-500/30"
                    : "text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/20 border-white/[0.06]"
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                {isReplyOpen ? "Cancel" : "Reply to Discussion"}
              </button>
            </div>

            {repliesOpen && replies.length > 0 && (
              <div className="ml-11 space-y-3 border-l-2 border-white/[0.06] pl-3">
                {replies.map((r) => {
                  const isReplyExpert = r.author?.role === "expert" || r.author?.role === "admin";
                  return (
                    <div key={r.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-white/[0.05] flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                        {getInitials(r.author?.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-xs">{r.author?.fullName ?? "User"}</span>
                          {isReplyExpert && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-2 h-2" /> Expert
                            </span>
                          )}
                          <span className="text-zinc-600 text-[10px]">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{r.content}</p>
                        <button
                          onClick={() => handleToggleReplyLike(d.id, r.id)}
                          className={`flex items-center gap-1 text-xs mt-1 hover:text-white transition ${r.likedByMe ? "text-purple-400" : "text-zinc-500"}`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {r.likesCount}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <AnimatePresence>
              {isReplyOpen && (
                <motion.div
                  key={`reply-${d.id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="ml-11 flex gap-2 pt-1">
                    <input
                      value={replyText[d.id] ?? ""}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      placeholder="Write your reply..."
                      autoFocus
                      className="flex-1 bg-white/[0.03] border border-purple-500/20 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handlePostReply(d.id).then(() => setReplyOpen(prev => ({ ...prev, [d.id]: false })));
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-9 px-3 rounded-xl text-xs shrink-0"
                      onClick={() => handlePostReply(d.id).then(() => setReplyOpen(prev => ({ ...prev, [d.id]: false })))}
                      disabled={!replyText[d.id]?.trim() || replyPosting[d.id]}
                    >
                      {replyPosting[d.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <><Send className="w-3.5 h-3.5 mr-1" />Send Reply</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onLike,
  onBuyNow,
  autoExpand = false,
}: Readonly<{ post: PostWithDetails; onLike: (id: string) => void; onBuyNow: (post: PostWithDetails) => void; autoExpand?: boolean }>) {
  const router = useRouter();
  const [showDiscussions, setShowDiscussions] = useState(autoExpand);

  const isExpertReview = post.expert !== null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f12] hover:bg-[#111116] hover:border-white/[0.14] transition-all duration-300 shadow-lg overflow-hidden">
      {/* Top accent line for expert reviews */}
      {isExpertReview && (
        <div className="h-px bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-transparent" />
      )}

      <div className="p-6 space-y-5">
        {/* Author + product */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a1a22] to-[#222228] border border-white/[0.1] flex items-center justify-center text-sm font-bold shrink-0 text-white shadow-inner">
              {getInitials(post.expert?.fullName)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-white text-[15px] leading-none">
                  {post.expert?.fullName ?? "Community Member"}
                </p>
                {isExpertReview && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Expert Review
                  </span>
                )}
                {!isExpertReview && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Star className="w-3 h-3" /> Showcase
                  </span>
                )}
              </div>
              <p className="text-zinc-500 text-xs mt-1">{timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {post.product && (
            <button
              onClick={() => router.push(`/consumer/products/${post.product!.id}`)}
              className="group flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] rounded-xl px-2.5 py-2 transition-all active:scale-95 shrink-0 max-w-[180px]"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-white transition-colors" />
              <span className="truncate leading-none">{post.product.name}</span>
            </button>
          )}
        </div>

        {/* Title + content */}
        {post.title && (
          <h3 className="font-bold text-white text-lg leading-snug">{post.title}</h3>
        )}
        <p className="text-zinc-400 text-sm leading-relaxed">{post.content}</p>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {([1, 2, 3, 4, 5] as const).map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${s <= post.rating ? "fill-orange-400 text-orange-400" : "text-zinc-800"}`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-orange-400 ml-1">{post.rating}/5</span>
        </div>

        {/* Pros / Cons */}
        {(post.pros?.length || post.cons?.length) ? (
          <div className="grid grid-cols-2 gap-0 text-sm rounded-xl overflow-hidden border border-white/[0.06]">
            {post.pros?.length ? (
              <div className="space-y-2 p-4 bg-emerald-500/[0.03]">
                <p className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Pros
                </p>
                {post.pros.map((p) => (
                  <p key={p} className="text-zinc-300 text-xs flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5 shrink-0">•</span>{p}
                  </p>
                ))}
              </div>
            ) : <div />}
            {post.cons?.length ? (
              <div className="space-y-2 p-4 bg-red-500/[0.03] border-l border-white/[0.05]">
                <p className="text-red-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <span className="font-black text-sm leading-none">−</span> Cons
                </p>
                {post.cons.map((c) => (
                  <p key={c} className="text-zinc-300 text-xs flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5 shrink-0">•</span>{c}
                  </p>
                ))}
              </div>
            ) : <div />}
          </div>
        ) : null}

        {/* Verdict */}
        {post.verdict && (
          <div className="relative p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl">
            <div className="absolute left-4 top-4 text-emerald-400/30 text-4xl leading-none font-serif select-none">"</div>
            <p className="text-sm font-medium italic text-emerald-300 leading-relaxed pl-5">
              {post.verdict}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 pt-3 border-t border-white/[0.05]">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 hover:text-white transition font-semibold py-1.5 px-2.5 rounded-lg hover:bg-white/[0.05] ${post.hasLiked ? "text-purple-400 bg-purple-400/10" : ""}`}
          >
            <ThumbsUp className="w-4 h-4" />
            {post.likesCount}
          </button>
          <button
            onClick={() => setShowDiscussions((v) => !v)}
            className={`flex items-center gap-1.5 transition font-bold px-3 py-1.5 rounded-lg border text-xs ${
              showDiscussions
                ? "text-purple-300 bg-purple-500/15 border-purple-500/30"
                : "text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/20 border-white/[0.06]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {showDiscussions ? "Hide Discussion" : "Join Conversation"}
          </button>
          {post.product && (
            <button
              onClick={() => onBuyNow(post)}
              className="flex items-center gap-1.5 ml-auto text-emerald-400 hover:text-emerald-300 transition font-bold active:scale-95 bg-emerald-400/10 hover:bg-emerald-400/15 px-3 py-1.5 rounded-lg border border-emerald-400/20"
            >
              <ShoppingBag className="w-4 h-4" />
              Buy Now
            </button>
          )}
        </div>

        {showDiscussions && <DiscussionThread postId={post.id} />}
      </div>
    </div>
  );
}

// ── CommunityDiscussionsTab ───────────────────────────────────────────────────

interface DiscussionItem {
  discussion: PostDiscussion;
  post: PostWithDetails;
}

function CommunityDiscussionsTab({
  items,
  loading,
  replyOpen,
  replyText,
  replyPosting,
  onToggleReply,
  onReplyTextChange,
  onPostReply,
  onToggleLike,
}: Readonly<{
  items: DiscussionItem[];
  loading: boolean;
  replyOpen: Record<string, boolean>;
  replyText: Record<string, string>;
  replyPosting: Record<string, boolean>;
  onToggleReply: (id: string) => void;
  onReplyTextChange: (id: string, value: string) => void;
  onPostReply: (postId: string, discussionId: string) => void;
  onToggleLike: (postId: string, discussionId: string) => void;
}>) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="h-7 w-7 animate-spin text-purple-500" />
        <p className="text-zinc-500 text-sm">Loading community discussions...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-12 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#111] border border-white/[0.06] flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-zinc-600" />
        </div>
        <div>
          <p className="text-white font-bold text-lg">No discussions yet</p>
          <p className="text-zinc-500 text-sm mt-1">Open an expert review and start the first conversation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(({ discussion: d, post }) => {
        const isExpertAuthor = d.author?.role === "expert" || d.author?.role === "admin";
        const replies = d.replies ?? [];

        return (
          <div
            key={d.id}
            className="bg-[#0f0f12] border border-white/[0.07] hover:border-purple-500/20 rounded-2xl p-5 space-y-4 transition-all duration-200 group"
          >
            {/* Product context badge */}
            {post.product && (
              <button
                onClick={() => router.push(`/consumer/products/${post.product!.id}`)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] px-2.5 py-1 rounded-lg transition-colors"
              >
                <ShoppingBag className="w-3 h-3" />
                {post.product.name}
              </button>
            )}

            {/* Discussion author + content */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 shrink-0">
                {getInitials(d.author?.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-white text-sm">{d.author?.fullName ?? "Community Member"}</span>
                  {isExpertAuthor && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Expert
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-600 ml-auto">{timeAgo(d.createdAt)}</span>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{d.content}</p>
              </div>
            </div>

            {/* Replies thread */}
            {replies.length > 0 && (
              <div className="border-l-2 border-purple-500/15 ml-5 pl-4 space-y-3">
                {replies.map((r) => {
                  const isExpertReply = r.author?.role === "expert" || r.author?.role === "admin";
                  return (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isExpertReply
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-white/[0.03] border-white/[0.06] text-zinc-400"
                      }`}>
                        {getInitials(r.author?.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold text-white">{r.author?.fullName ?? "User"}</span>
                          {isExpertReply && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-2 h-2" /> Expert
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{r.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats + reply button */}
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04] text-xs text-zinc-500">
              <button
                onClick={() => onToggleLike(post.id, d.id)}
                className={`flex items-center gap-1.5 font-semibold hover:text-white transition py-1 px-2 rounded-lg hover:bg-white/[0.05] ${d.likedByMe ? "text-purple-400" : ""}`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {d.likesCount} {d.likesCount === 1 ? "like" : "likes"}
              </button>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </span>
              <button
                onClick={() => onToggleReply(d.id)}
                className={`flex items-center gap-1.5 font-bold ml-auto px-2.5 py-1 rounded-lg border transition-all ${
                  replyOpen[d.id]
                    ? "text-purple-300 bg-purple-500/15 border-purple-500/30"
                    : "text-zinc-400 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/20 border-white/[0.06]"
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                {replyOpen[d.id] ? "Cancel" : "Reply"}
              </button>
            </div>

            {/* Animated reply input */}
            <AnimatePresence>
              {replyOpen[d.id] && (
                <motion.div
                  key={`disc-reply-${d.id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="ml-5 flex gap-2 pt-2">
                    <input
                      value={replyText[d.id] ?? ""}
                      onChange={(e) => onReplyTextChange(d.id, e.target.value)}
                      placeholder="Write your reply..."
                      autoFocus
                      className="flex-1 bg-white/[0.03] border border-purple-500/20 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          onPostReply(post.id, d.id);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-9 px-3 rounded-xl text-xs shrink-0"
                      onClick={() => onPostReply(post.id, d.id)}
                      disabled={!replyText[d.id]?.trim() || replyPosting[d.id]}
                    >
                      {replyPosting[d.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <><Send className="w-3.5 h-3.5 mr-1" />Send</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CommunityMember {
  id: string;
  userId: string;
  communityId?: string;
  isExpert: boolean;
  joinedAt: string;
  user?: {
    fullName: string | null;
    avatarUrl: string | null;
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CommunityDetailPage: FC<PageProps> = ({ params }) => {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useModalStore();
  const {
    joinedCommunities,
    fetchJoinedCommunities,
    joinCommunity: storeJoinCommunity,
    leaveCommunity: storeLeaveCommunity,
    joiningIds,
  } = useCommunityStore();

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [communityProducts, setCommunityProducts] = useState<Product[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"discussions" | "reviews">("discussions");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Community-wide discussions state
  const [communityDiscussions, setCommunityDiscussions] = useState<DiscussionItem[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(false);
  const [replyOpenDisc, setReplyOpenDisc] = useState<Record<string, boolean>>({});
  const [replyTextDisc, setReplyTextDisc] = useState<Record<string, string>>({});
  const [replyPostingDisc, setReplyPostingDisc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadCommunity() {
      try {
        setLoading(true);
        if (isAuthenticated) {
          await fetchJoinedCommunities();
        }

        const [data, membersResult, productsResult, postsResult] = await Promise.all([
          getCommunityById(id),
          getCommunityMembers(id, { limit: 50 }),
          getProducts({ limit: 100 }),
          PostService.getPosts({
            communityId: id,
            isPublished: "true",
            limit: 50,
            sortBy: "created_at",
            sortOrder: "desc",
          }),
        ]);
        if (!controller.signal.aborted) {
          setCommunity(data);
          setMembers(membersResult.data as CommunityMember[]);
          setPosts(postsResult.data);
          setPostsLoading(false);
          // Only show products that have at least one published expert review
          const reviewedProductIds = new Set(postsResult.data.map((p) => p.productId));
          setCommunityProducts(
            productsResult.data.filter(
              (p) => p.communityId === id && reviewedProductIds.has(p.id)
            )
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          toast.error("Community not found");
          router.push("/consumer/communities");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCommunity();
    return () => controller.abort();
  }, [id, isAuthenticated, fetchJoinedCommunities]);

  // Load community-wide discussions when tab opens
  useEffect(() => {
    if (activeTab !== "discussions" || posts.length === 0) return;
    if (communityDiscussions.length > 0) return;
    async function loadDiscussions() {
      setDiscussionsLoading(true);
      try {
        const results = await Promise.all(
          posts.slice(0, 15).map(async (post) => {
            const discs = await getPostDiscussions(post.id);
            return discs.map((d) => ({ discussion: d, post }));
          })
        );
        setCommunityDiscussions(
          results.flat().sort((a, b) =>
            new Date(b.discussion.createdAt).getTime() - new Date(a.discussion.createdAt).getTime()
          )
        );
      } catch {
        // non-critical
      } finally {
        setDiscussionsLoading(false);
      }
    }
    loadDiscussions();
  }, [activeTab, posts]);

  const isMember = joinedCommunities.includes(id);
  const isJoining = joiningIds.includes(id);

  async function handleJoin() {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to join this community", onComplete: handleJoin });
      return;
    }
    if (isJoining) return;
    try {
      await storeJoinCommunity(id);
      setCommunity((prev) => prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev);
      toast.success("Joined community!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to join community");
    }
  }

  async function handleLeave() {
    try {
      await storeLeaveCommunity(id);
      setCommunity((prev) => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
      toast.success("Left community");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to leave community");
    }
  }

  function handleBuyNow(post: PostWithDetails) {
    if (post.product) {
      router.push(`/consumer/products/${post.product.id}`);
      return;
    }
    router.push(`/consumer/checkout?postId=${post.id}`);
  }

  async function handleLikePost(postId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to like this post", onComplete: () => handleLikePost(postId) });
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      if (post.hasLiked) {
        await PostService.unlikePost(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, hasLiked: false, likesCount: p.likesCount - 1 } : p
          )
        );
      } else {
        await PostService.likePost(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, hasLiked: true, likesCount: p.likesCount + 1 } : p
          )
        );
      }
    } catch {
      toast.error("Failed to update like");
    }
  }

  async function handleToggleLikeDisc(postId: string, discussionId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to like this discussion", onComplete: () => handleToggleLikeDisc(postId, discussionId) });
      return;
    }
    try {
      const result = await togglePostDiscussionLike(postId, discussionId);
      setCommunityDiscussions((prev) =>
        prev.map((item) =>
          item.discussion.id === discussionId
            ? { ...item, discussion: { ...item.discussion, likesCount: result.likesCount, likedByMe: result.liked } }
            : item
        )
      );
    } catch {
      toast.error("Failed to update like");
    }
  }

  async function handleCommunityDiscussionReply(postId: string, discussionId: string) {
    if (!isAuthenticated) {
      openLoginModal({ message: "Login to reply", onComplete: () => handleCommunityDiscussionReply(postId, discussionId) });
      return;
    }
    const text = replyTextDisc[discussionId]?.trim();
    if (!text) return;
    try {
      setReplyPostingDisc((prev) => ({ ...prev, [discussionId]: true }));
      const reply = await createPostDiscussionReply(postId, discussionId, text);
      setCommunityDiscussions((prev) =>
        prev.map((item) =>
          item.discussion.id === discussionId
            ? { ...item, discussion: { ...item.discussion, replies: [...(item.discussion.replies ?? []), reply] } }
            : item
        )
      );
      setReplyTextDisc((prev) => ({ ...prev, [discussionId]: "" }));
      setReplyOpenDisc((prev) => ({ ...prev, [discussionId]: false }));
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setReplyPostingDisc((prev) => ({ ...prev, [discussionId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!community) return null;

  const expertMembers = members.filter((m) => m.isExpert);
  const highlightedExpert = expertMembers.length > 0 ? expertMembers[0] : null;
  const activeThread = posts.length > 0 ? posts[0] : null;
  const reviewsOnly = posts.filter((p) => p.expert !== null);

  return (
    <div className="min-h-screen bg-[#000] pb-24 text-zinc-100">
      <div className="max-w-[1250px] mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0a0a0c] shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-[#0a0a0c] to-blue-900/10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 p-8 lg:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/[0.03] border border-white/[0.1] flex items-center justify-center shadow-xl shrink-0 backdrop-blur-md overflow-hidden">
                {community.imageUrl ? (
                  <img
                    src={community.imageUrl}
                    alt={community.name}
                    loading="eager"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-12 h-12 text-purple-400" />
                )}
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.1] text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified Community
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {community.name}
                </h1>
                <p className="text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
                  {community.description || "A curated space for enthusiasts to discuss, review, and discover top-tier products."}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-white">{community.memberCount ?? 0}</span>
                    <span className="text-zinc-500">Members</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-white">{posts.length}</span>
                    <span className="text-zinc-500">Reviews</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span className="text-white">{communityProducts.length}</span>
                    <span className="text-zinc-500">Products</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 shrink-0 mt-4 md:mt-0">
              {isMember ? (
                <Button
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={isJoining}
                  className="h-11 px-8 rounded-xl font-bold transition-all active:scale-95 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 shadow-none"
                >
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  Leave
                </Button>
              ) : (
                <Button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="h-11 px-8 rounded-xl font-bold transition-all active:scale-95 shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-purple-500/50"
                >
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Join Community
                </Button>
              )}
              <Button variant="outline" className="h-11 px-4 rounded-xl border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── 2-COLUMN LAYOUT ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* MAIN CONTENT (LEFT 8 COLS) */}
          <div className="lg:col-span-8 space-y-6">

            {/* TABS */}
            <div className="sticky top-0 z-40 bg-[#000]/80 backdrop-blur-xl border-b border-white/[0.08] pt-2 pb-0">
              <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab("discussions")}
                  className={`pb-4 text-sm font-bold whitespace-nowrap transition-colors relative flex items-center gap-2 ${activeTab === "discussions" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Discussions
                  {communityDiscussions.length > 0 && (
                    <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                      {communityDiscussions.length}
                    </span>
                  )}
                  {activeTab === "discussions" && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`pb-4 text-sm font-bold whitespace-nowrap transition-colors relative flex items-center gap-2 ${activeTab === "reviews" ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Expert Reviews
                  {reviewsOnly.length > 0 && (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                      {reviewsOnly.length}
                    </span>
                  )}
                  {activeTab === "reviews" && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-t-full" />
                  )}
                </button>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="min-h-[400px]">
              {/* Discussions Tab */}
              {activeTab === "discussions" && (
                postsLoading ? (
                  <div className="space-y-4">
                    <PostSkeleton />
                    <PostSkeleton />
                  </div>
                ) : (
                  <CommunityDiscussionsTab
                    items={communityDiscussions}
                    loading={discussionsLoading}
                    replyOpen={replyOpenDisc}
                    replyText={replyTextDisc}
                    replyPosting={replyPostingDisc}
                    onToggleReply={(id) => {
                      if (!isAuthenticated) {
                        openLoginModal({ message: "Login to reply", onComplete: () => setReplyOpenDisc((prev) => ({ ...prev, [id]: true })) });
                        return;
                      }
                      setReplyOpenDisc((prev) => ({ ...prev, [id]: !prev[id] }));
                    }}
                    onReplyTextChange={(id, val) => setReplyTextDisc((prev) => ({ ...prev, [id]: val }))}
                    onPostReply={handleCommunityDiscussionReply}
                    onToggleLike={handleToggleLikeDisc}
                  />
                )
              )}

              {/* Expert Reviews Tab */}
              {activeTab === "reviews" && (
                postsLoading ? (
                  <div className="space-y-4">
                    <PostSkeleton />
                    <PostSkeleton />
                  </div>
                ) : reviewsOnly.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-12 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#111] border border-white/[0.06] flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-zinc-600" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">No expert reviews yet</p>
                      <p className="text-zinc-500 text-sm">Expert reviews will appear here once published.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {reviewsOnly.map((post) => (
                      <PostCard key={post.id} post={post} onLike={handleLikePost} onBuyNow={handleBuyNow} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR (4 COLS) */}
          <div className="lg:col-span-4 space-y-6">
            {/* About Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-6 space-y-4">
              <h3 className="font-bold text-white text-lg">About Community</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {community.description || "Join this community to discover top-tier products, expert reviews, and engage in high-quality discussions with fellow enthusiasts."}
              </p>
              <div className="pt-4 border-t border-white/[0.06] space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Created</span>
                  <span className="text-white font-medium">{new Date(community.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Category</span>
                  <span className="text-white font-medium capitalize">{community.category?.name ?? "General"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Status</span>
                  <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Active</span>
                </div>
              </div>
            </div>

            {/* Expert Card */}
            {highlightedExpert && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0c] overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-700" />
                <div className="p-6 relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 shrink-0 overflow-hidden">
                      {highlightedExpert.user?.avatarUrl ? (
                        <img src={highlightedExpert.user.avatarUrl} alt="Expert" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(highlightedExpert.user?.fullName)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-white">{highlightedExpert.user?.fullName || "Verified Expert"}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Expert Verified
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl relative">
                    <p className="text-xs text-zinc-400 italic">"I review top products in this space to ensure quality standards."</p>
                  </div>
                </div>
              </div>
            )}

            {/* Active Thread CTA */}
            {activeThread && (
              <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-[#0a0a0c] to-[#050508] p-6 space-y-4 relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700" />
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  <Flame className="w-3 h-3" /> Hot Thread
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight mb-1">{activeThread.title || "Community Discussion"}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-2">{activeThread.content}</p>
                </div>
                <button
                  onClick={() => setActiveTab("discussions")}
                  className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-bold text-white transition active:scale-95"
                >
                  Join Discussion
                </button>
              </div>
            )}

            {/* Trust Block */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Free shipping</p>
                  <p className="text-xs text-zinc-500">On all community picks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center shrink-0">
                  <RefreshCcw className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">30-day return</p>
                  <p className="text-xs text-zinc-500">No questions asked</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Verified Quality</p>
                  <p className="text-xs text-zinc-500">Tested by experts</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── LEAVE COMMUNITY CONFIRMATION ─────────────────────────────────── */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="bg-[#0b0b0b] border border-white/10 text-white rounded-2xl max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-lg font-bold">Leave Community?</DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-sm mt-2 leading-relaxed">
              Are you sure you want to leave{" "}
              <span className="text-white font-semibold">{community?.name}</span>?
              You may miss future discussions, expert reviews, and product updates.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/5"
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold"
              disabled={isJoining}
              onClick={async () => {
                setShowLeaveConfirm(false);
                await handleLeave();
              }}
            >
              {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Leave Community"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MOBILE STICKY CTA ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-50 md:hidden pointer-events-none">
        <button
          onClick={isMember ? () => setShowLeaveConfirm(true) : handleJoin}
          disabled={isJoining}
          className={`w-full py-3.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg pointer-events-auto flex items-center justify-center gap-2 ${
            isMember
              ? "bg-red-500/10 text-red-400 border border-red-500/30 backdrop-blur-md hover:bg-red-500/20"
              : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-purple-500/50"
          }`}
        >
          {isJoining ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isMember ? (
            <LogOut className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {isMember ? "Leave" : "Join Community"}
        </button>
      </div>
    </div>
  );
};

export default CommunityDetailPage;
