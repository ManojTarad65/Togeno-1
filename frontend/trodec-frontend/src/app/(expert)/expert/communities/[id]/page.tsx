"use client";

import { useState, useEffect, use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Users, Edit,
  Star, ThumbsUp, Send, ChevronDown, ChevronUp,
  MessageSquare, Plus, ShoppingBag, ExternalLink, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCommunityById, getCommunityMembers, CommunityMember, Community } from "@/services";
import { PostService, PostWithDetails } from "@/services/post.service";
import {
  PostDiscussion,
  getPostDiscussions,
  createPostDiscussion,
  togglePostDiscussionLike,
  createPostDiscussionReply,
  togglePostDiscussionReplyLike,
} from "@/services/post_discussion.service";

// ── helpers ──────────────────────────────────────────────────────────────────

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
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function updateReplyLike(
  d: PostDiscussion,
  discussionId: string,
  replyId: string,
  result: { liked: boolean; likesCount: number }
) {
  if (d.id !== discussionId) return d;
  const replies = (d.replies ?? []).map(r =>
    r.id === replyId ? { ...r, likesCount: result.likesCount, likedByMe: result.liked } : r
  );
  return { ...d, replies };
}

// ── DiscussionThread component ────────────────────────────────────────────────

function DiscussionThread({ postId }: Readonly<{ postId: string }>) {
  const [discussions, setDiscussions] = useState<PostDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
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
      data.forEach(d => { if ((d.replies?.length ?? 0) > 0) expanded[d.id] = true; });
      setShowReplies(prev => ({ ...prev, ...expanded }));
    } catch (err: any) {
      toast.error(err.message || "Failed to load discussions");
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!newPost.trim()) return;
    try {
      setPosting(true);
      const created = await createPostDiscussion(postId, newPost.trim());
      setDiscussions(prev => [created, ...prev]);
      setNewPost("");
    } catch {
      toast.error("Failed to post discussion");
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleLike(discussionId: string) {
    try {
      const result = await togglePostDiscussionLike(postId, discussionId);
      setDiscussions(prev =>
        prev.map(d => d.id === discussionId ? { ...d, likesCount: result.likesCount, likedByMe: result.liked } : d)
      );
    } catch { toast.error("Failed to update like"); }
  }

  async function handlePostReply(discussionId: string) {
    const text = replyText[discussionId]?.trim();
    if (!text) return;
    try {
      setReplyPosting(prev => ({ ...prev, [discussionId]: true }));
      const reply = await createPostDiscussionReply(postId, discussionId, text);
      setDiscussions(prev =>
        prev.map(d => d.id === discussionId ? { ...d, replies: [...(d.replies ?? []), reply] } : d)
      );
      setReplyText(prev => ({ ...prev, [discussionId]: "" }));
      setShowReplies(prev => ({ ...prev, [discussionId]: true }));
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setReplyPosting(prev => ({ ...prev, [discussionId]: false }));
    }
  }

  async function handleToggleReplyLike(discussionId: string, replyId: string) {
    try {
      const result = await togglePostDiscussionReplyLike(postId, replyId);
      setDiscussions(prev => prev.map(d => updateReplyLike(d, discussionId, replyId, result)));
    } catch { toast.error("Failed to update like"); }
  }

  return (
    <div className="space-y-4 border-t border-white/5 pt-4 mt-2">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <MessageSquare className="w-4 h-4" />
        <span>Discussions ({discussions.length})</span>
      </div>

      {/* Post form */}
      <div className="flex gap-2">
        <input
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="Start a discussion..."
          className="flex-1 bg-zinc-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          onKeyDown={e => e.key === "Enter" && handlePost()}
        />
        <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white"
          onClick={handlePost} disabled={!newPost.trim() || posting}>
          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* List */}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-500 mx-auto" />}

      {!loading && discussions.length === 0 && (
        <p className="text-zinc-600 text-xs text-center py-2">No discussions yet</p>
      )}

      {!loading && discussions.map(d => {
        const replies = d.replies ?? [];
        const repliesOpen = showReplies[d.id] ?? false;
        const replyIcon = replyPosting[d.id]
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Send className="w-3 h-3" />;
        return (
          <div key={d.id} className="bg-zinc-800/40 rounded-xl p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(d.author?.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-white">{d.author?.fullName ?? "User"}</span>
                  <span className="text-zinc-500">{timeAgo(d.createdAt)}</span>
                </div>
                <p className="text-zinc-300 text-sm mt-0.5">{d.content}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 ml-9">
              <button onClick={() => handleToggleLike(d.id)}
                className={`flex items-center gap-1 hover:text-white transition ${d.likedByMe ? "text-blue-400" : ""}`}>
                <ThumbsUp className="w-3 h-3" />{d.likesCount}
              </button>
              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                  className="flex items-center gap-1 hover:text-white transition">
                  {repliesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </button>
              )}
            </div>

            {repliesOpen && replies.length > 0 && (
              <div className="ml-9 space-y-2 border-l border-white/10 pl-3">
                {replies.map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(r.author?.fullName)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-white">{r.author?.fullName ?? "User"}</span>
                        <span className="text-zinc-500">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5">{r.content}</p>
                      <button
                        onClick={() => handleToggleReplyLike(d.id, r.id)}
                        className={`flex items-center gap-1 text-xs mt-1 hover:text-white transition ${r.likedByMe ? "text-blue-400" : "text-zinc-500"}`}>
                        <ThumbsUp className="w-3 h-3" />{r.likesCount}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ml-9 flex gap-2">
              <input
                value={replyText[d.id] ?? ""}
                onChange={e => setReplyText(prev => ({ ...prev, [d.id]: e.target.value }))}
                placeholder="Reply..."
                className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                onKeyDown={e => e.key === "Enter" && handlePostReply(d.id)}
              />
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                onClick={() => handlePostReply(d.id)}
                disabled={!replyText[d.id]?.trim() || replyPosting[d.id]}>
                {replyIcon}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PostCard component ────────────────────────────────────────────────────────

function PostCard({ post, onLike }: Readonly<{ post: PostWithDetails; onLike: (id: string) => void }>) {
  const router = useRouter();
  const [showDiscussions, setShowDiscussions] = useState(false);

  return (
    <Card className="bg-[#0e0e0e] border-[#1a1a1a]">
      <CardContent className="p-5 space-y-4">

        {/* Author + product */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(post.expert?.fullName)}
            </div>
            <div>
              <p className="font-semibold text-sm">{post.expert?.fullName ?? "Expert"}</p>
              <p className="text-zinc-500 text-xs">{timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {post.product && (
            <button
              onClick={() => router.push(`/expert/products/${post.product!.id}`)}
              className="group flex items-center gap-2 text-xs font-semibold text-white bg-white/[0.06] hover:bg-emerald-500/10 border border-white/[0.12] hover:border-emerald-500/30 rounded-xl px-3 py-2.5 transition-all duration-200 active:scale-95 min-w-0"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="max-w-[180px] truncate leading-none">{post.product.name}</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400 transition-colors shrink-0" />
            </button>
          )}
        </div>

        {/* Title + content */}
        {post.title && <h3 className="font-bold text-white">{post.title}</h3>}
        <p className="text-zinc-300 text-sm leading-relaxed">{post.content}</p>

        {/* Rating */}
        <div className="flex gap-0.5">
          {([1,2,3,4,5] as const).map(s => (
            <Star key={s} className={`w-4 h-4 ${s <= post.rating ? "fill-orange-400 text-orange-400" : "text-zinc-700"}`} />
          ))}
        </div>

        {/* Pros / Cons */}
        {(post.pros?.length || post.cons?.length) ? (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {post.pros?.length ? (
              <div className="space-y-1">
                <p className="text-emerald-400 font-semibold">Pros</p>
                {post.pros.map(p => <p key={p} className="text-zinc-400">+ {p}</p>)}
              </div>
            ) : null}
            {post.cons?.length ? (
              <div className="space-y-1">
                <p className="text-red-400 font-semibold">Cons</p>
                {post.cons.map(c => <p key={c} className="text-zinc-400">- {c}</p>)}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Verdict */}
        {post.verdict && (
          <p className="text-sm italic text-zinc-400 border-l-2 border-emerald-500/40 pl-3">
            "{post.verdict}"
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 hover:text-white transition ${post.hasLiked ? "text-blue-400" : ""}`}>
            <ThumbsUp className="w-4 h-4" />{post.likesCount}
          </button>
          <button
            onClick={() => setShowDiscussions(v => !v)}
            className="flex items-center gap-1.5 hover:text-white transition">
            <MessageSquare className="w-4 h-4" />
            {post.commentsCount} {showDiscussions ? "▲" : "▼"}
          </button>
        </div>

        {showDiscussions && <DiscussionThread postId={post.id} />}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ExpertCommunityDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "discussions" | "members">("posts");

  const [communityDiscussions, setCommunityDiscussions] = useState<
    Array<{ discussion: PostDiscussion; post: PostWithDetails }>
  >([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(false);
  const [replyOpenDisc, setReplyOpenDisc] = useState<Record<string, boolean>>({});
  const [replyTextDisc, setReplyTextDisc] = useState<Record<string, string>>({});
  const [replyPostingDisc, setReplyPostingDisc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadAll() {
      try {
        const [comm, postsRes] = await Promise.all([
          getCommunityById(id),
          PostService.getPosts({ communityId: id, isPublished: "true", limit: 50 }),
        ]);
        setCommunity(comm);
        setPosts(postsRes.data);
      } catch {
        toast.error("Failed to load community");
      } finally {
        setIsLoading(false);
      }

      try {
        const membersRes = await getCommunityMembers(id, { limit: 100 });
        setMembers(membersRes.data);
      } catch {
        // non-critical
      }
    }
    loadAll();
  }, [id]);

  // Load all community discussions when the discussions tab is first opened
  useEffect(() => {
    if (activeTab !== "discussions" || posts.length === 0) return;
    if (communityDiscussions.length > 0) return; // already loaded
    async function loadDiscussions() {
      setDiscussionsLoading(true);
      try {
        const results = await Promise.all(
          posts.slice(0, 15).map(async (post) => {
            const discs = await getPostDiscussions(post.id);
            return discs.map(d => ({ discussion: d, post }));
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

  async function handleCommunityDiscussionReply(postId: string, discussionId: string) {
    const text = replyTextDisc[discussionId]?.trim();
    if (!text) return;
    try {
      setReplyPostingDisc(prev => ({ ...prev, [discussionId]: true }));
      const reply = await createPostDiscussionReply(postId, discussionId, text);
      setCommunityDiscussions(prev => prev.map(item =>
        item.discussion.id === discussionId
          ? { ...item, discussion: { ...item.discussion, replies: [...(item.discussion.replies ?? []), reply] } }
          : item
      ));
      setReplyTextDisc(prev => ({ ...prev, [discussionId]: "" }));
      setReplyOpenDisc(prev => ({ ...prev, [discussionId]: false }));
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setReplyPostingDisc(prev => ({ ...prev, [discussionId]: false }));
    }
  }

  async function handleLike(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    try {
      if (post.hasLiked) {
        await PostService.unlikePost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, hasLiked: false, likesCount: p.likesCount - 1 } : p));
      } else {
        await PostService.likePost(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, hasLiked: true, likesCount: p.likesCount + 1 } : p));
      }
    } catch { toast.error("Failed to update like"); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="space-y-8 text-white max-w-4xl mx-auto">
        <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
            <h3 className="text-lg font-semibold mb-2">Community not found</h3>
            <Button onClick={() => router.push("/expert/communities")} className="bg-emerald-600 hover:bg-emerald-500">
              Back to Communities
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-white max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="h-10 w-10 p-0 text-zinc-400 hover:text-white hover:bg-white/5"
            onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{community.name}</h1>
              <Badge variant="outline" className={community.isActive
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                : "border-zinc-500/30 text-zinc-400 bg-zinc-500/5"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1 text-sm">/{community.slug}</p>
          </div>
        </div>

        <div className="flex gap-2">

          <Button variant="outline" className="border-white/10 hover:bg-white/5"
            onClick={() => router.push(`/expert/communities/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />Edit
          </Button>
        </div>
      </div>

      {/* Cover */}
      {community.coverImageUrl && (
        <div className="relative h-56 md:h-64 rounded-xl overflow-hidden border border-[#1a1a1a]">
          <img src={community.coverImageUrl} alt={community.name} loading="eager" decoding="async" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-5">

          {/* Tabs */}
          <div className="flex gap-1 bg-[#0b0b0b] border border-[#1a1a1a] rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "posts" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Posts <span className="text-xs opacity-60">({posts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("discussions")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "discussions" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Discussions
              {communityDiscussions.length > 0 && (
                <span className="text-xs opacity-70">({communityDiscussions.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "members" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              Members <span className="text-xs opacity-60">({members.length})</span>
            </button>
          </div>

          {/* Posts tab */}
          {activeTab === "posts" && (
            <>
              {posts.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    onClick={() => router.push(`/expert/posts/new?communityId=${id}`)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Write Review
                  </Button>
                </div>
              )}
              {posts.length === 0 ? (
                <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
                  <CardContent className="py-12 text-center">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                    <p className="text-zinc-400">No posts yet. Be the first to review a product!</p>
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => router.push(`/expert/posts/new?communityId=${id}`)}>
                      <Plus className="w-4 h-4 mr-2" /> Post Review
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                posts.map(post => <PostCard key={post.id} post={post} onLike={handleLike} />)
              )}
            </>
          )}

          {/* Discussions tab */}
          {activeTab === "discussions" && (
            <div className="space-y-4">
              {discussionsLoading && (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
                  <p className="text-zinc-500 text-sm">Loading community discussions...</p>
                </div>
              )}

              {!discussionsLoading && communityDiscussions.length === 0 && (
                <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
                  <CardContent className="py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="h-7 w-7 text-zinc-600" />
                    </div>
                    <p className="text-white font-bold">No discussions yet</p>
                    <p className="text-zinc-500 text-sm mt-1">Discussions from community posts will appear here.</p>
                  </CardContent>
                </Card>
              )}

              {!discussionsLoading && communityDiscussions.map(({ discussion: d, post }) => {
                const isExpertAuthor = d.author?.role === "expert" || d.author?.role === "admin";
                const replies = d.replies ?? [];
                return (
                  <div
                    key={d.id}
                    className="bg-[#0e0e0e] border border-[#1a1a1a] hover:border-emerald-500/20 rounded-2xl p-5 space-y-4 transition-colors"
                  >
                    {/* Post context badge */}
                    {post.product && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg">
                          <ShoppingBag className="w-3 h-3" />
                          {post.product.name}
                        </span>
                      </div>
                    )}

                    {/* Discussion author + content */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
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
                          <span className="text-[11px] text-zinc-600 ml-auto">
                            {timeAgo(d.createdAt)}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed">{d.content}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 pt-2 border-t border-white/[0.04] text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {d.likesCount} {d.likesCount === 1 ? "like" : "likes"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {replies.length} {replies.length === 1 ? "reply" : "replies"}
                      </span>
                      <button
                        onClick={() => setReplyOpenDisc(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                        className={`flex items-center gap-1.5 font-bold ml-auto px-2.5 py-1 rounded-lg border transition-all ${
                          replyOpenDisc[d.id]
                            ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                            : "text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/20 border-white/[0.06]"
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {replyOpenDisc[d.id] ? "Cancel" : "Reply"}
                      </button>
                    </div>

                    {/* Expert replies */}
                    {replies.length > 0 && (
                      <div className="border-l-2 border-emerald-500/20 ml-4 pl-4 space-y-3">
                        {replies.map(r => {
                          const isExpertReply = r.author?.role === "expert" || r.author?.role === "admin";
                          return (
                            <div key={r.id} className="flex items-start gap-2.5">
                              <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isExpertReply
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-800 border-white/[0.06] text-zinc-400"
                              }`}>
                                {getInitials(r.author?.fullName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-xs font-bold text-white">{r.author?.fullName ?? "User"}</span>
                                  {isExpertReply && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-2 h-2" /> Expert Response
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">{r.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Animated reply input */}
                    <AnimatePresence>
                      {replyOpenDisc[d.id] && (
                        <motion.div
                          key={`disc-reply-${d.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 flex gap-2 pt-2">
                            <input
                              value={replyTextDisc[d.id] ?? ""}
                              onChange={e => setReplyTextDisc(prev => ({ ...prev, [d.id]: e.target.value }))}
                              placeholder="Write your reply..."
                              autoFocus
                              className="flex-1 bg-white/[0.03] border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                              onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleCommunityDiscussionReply(post.id, d.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 px-3 rounded-xl text-xs shrink-0"
                              onClick={() => handleCommunityDiscussionReply(post.id, d.id)}
                              disabled={!replyTextDisc[d.id]?.trim() || replyPostingDisc[d.id]}
                            >
                              {replyPostingDisc[d.id] ? (
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
          )}

          {/* Members tab */}
          {activeTab === "members" && (
            <div className="space-y-3">
              {members.length === 0 ? (
                <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
                  <CardContent className="py-12 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                    <p className="text-zinc-400">No members yet.</p>
                  </CardContent>
                </Card>
              ) : (
                members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 bg-[#0b0b0b] border border-[#1a1a1a] rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {member.user?.avatarUrl ? (
                        <img src={member.user.avatarUrl} className="w-9 h-9 rounded-full object-cover" alt="" />
                      ) : (
                        getInitials(member.user?.fullName)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {member.user?.fullName || "Unknown User"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{member.user?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.isExpert && (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                          Expert
                        </Badge>
                      )}
                      <span className="text-xs text-zinc-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
      </div>
    </div>
  );
}
