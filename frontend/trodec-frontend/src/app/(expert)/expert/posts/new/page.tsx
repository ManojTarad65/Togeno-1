"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Upload,
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PostService } from "@/services/post.service";
import { getCommunities, Community } from "@/services/communities.service";
import { getReceivedPitches } from "@/services/pitch.service";
import { uploadPostMedia } from "@/services/upload.service";

type PitchedProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  pitchId: string;
};

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [pitchedProducts, setPitchedProducts] = useState<PitchedProduct[]>([]);

  const [productId, setProductId] = useState<string>("");
  const [communityId, setCommunityId] = useState<string>(searchParams.get("communityId") ?? "");
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string }[]>([]);

  const [isSaved, setIsSaved] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [commResult, pitchesResult] = await Promise.all([
          getCommunities({ limit: 100, mine: true }),
          getReceivedPitches({ limit: 100 }),
        ]);

        setCommunities(commResult.data);

        const productsFromPitches: PitchedProduct[] = [];
        pitchesResult.data.forEach((pitch) => {
          // Only allow publishing reviews once the product has been delivered to the expert
          if (pitch.status === "delivered" && pitch.product) {
            productsFromPitches.push({
              ...pitch.product,
              pitchId: pitch.id,
            } as PitchedProduct);
          }
        });

        setPitchedProducts(productsFromPitches);
      } catch {
        toast.error("Failed to load your assigned products and communities");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (title || content || productId || communityId) {
      setIsSaved(false);
      const timer = setTimeout(() => {
        setIsSavingDraft(true);
        setTimeout(() => {
          setIsSavingDraft(false);
          setIsSaved(true);
        }, 800);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [title, content, productId, communityId, rating, tags]);

  const selectedProduct = pitchedProducts.find((p) => p.id === productId);
  const selectedCommunity = communities.find((c) => c.id === communityId);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newMedia = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setMediaFiles((prev) => [...prev, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleSubmit = async (isPublished: boolean) => {
    if (!productId || !selectedProduct) {
      toast.error("You must select a product from your accepted pitches.");
      return;
    }
    if (!communityId || !selectedCommunity) {
      toast.error("You must select a community you own.");
      return;
    }
    if (!content.trim() || !title.trim()) {
      toast.error("Please fill in all required fields (Title, Content)");
      return;
    }

    try {
      setIsSubmitting(true);

      const post = await PostService.createPost({
        productId,
        communityId,
        pitchId: selectedProduct.pitchId,
        title,
        content,
        rating,
        pros: tags.length > 0 ? tags.map((t) => `#${t}`) : null,
        cons: null,
        isPublished,
      });

      // Upload any attached media files sequentially
      if (mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          try {
            await uploadPostMedia(post.id, mediaFiles[i].file, i);
          } catch {
            toast.error(`Failed to upload media file ${i + 1}`);
          }
        }
      }

      toast.success(isPublished ? "Review Published! 🎉" : "Draft Saved!");
      router.push("/expert/posts");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#000] text-emerald-500">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <p className="text-zinc-500 font-medium">Loading Creator Studio...</p>
      </div>
    );
  }

  const noProducts = pitchedProducts.length === 0;
  const noCommunities = communities.length === 0;
  const blocked = noProducts || noCommunities;

  return (
    <div className="min-h-screen bg-[#000] text-white pb-24">
      {/* Top Navbar */}
      <div className="sticky top-0 z-40 bg-[#000]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="h-9 w-9 p-0 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold tracking-wider uppercase text-zinc-300">Creator Studio</h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                {isSavingDraft && (
                  <span className="flex items-center text-yellow-500">
                    <Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...
                  </span>
                )}
                {!isSavingDraft && isSaved && (
                  <span className="flex items-center text-emerald-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Saved to Drafts
                  </span>
                )}
                {!isSavingDraft && !isSaved && <span>Unsaved changes</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || blocked}
              className="border-white/10 hover:bg-white/5 font-bold h-9 hidden sm:flex"
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || blocked}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-9 px-6 rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish Review"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 mt-8 flex flex-col lg:flex-row gap-8">

        {/* LEFT COLUMN */}
        <div className="flex-1 space-y-8">

          <Card className="bg-[#111] border-white/[0.06] overflow-hidden rounded-2xl">
            <CardHeader className="bg-white/[0.02] border-b border-white/[0.04] pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-purple-400" />
                Core Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Select */}
                <div className="space-y-3">
                  <Label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                    Target Product <span className="text-red-400">*</span>
                  </Label>
                  {noProducts ? (
                    <div className="flex flex-col justify-center bg-red-500/5 border border-red-500/20 rounded-xl p-4 gap-3">
                      <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                        <AlertCircle className="w-4 h-4" /> No accepted pitches yet
                      </div>
                      <p className="text-xs text-zinc-500">Brands pitch products to you for review. Accept a pitch first, then come back to write your review.</p>
                      <button
                        type="button"
                        onClick={() => router.push("/expert/pitches")}
                        className="self-start text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all"
                      >
                        View My Pitches →
                      </button>
                    </div>
                  ) : (
                    <>
                      <Select value={productId} onValueChange={setProductId}>
                        <SelectTrigger className="w-full bg-[#0a0a0c] border-white/[0.1] h-14 rounded-xl text-left focus:ring-1 focus:ring-purple-500/50">
                          <SelectValue placeholder="Select a pitched product to review..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/[0.1] max-h-[300px]">
                          {pitchedProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="focus:bg-white/5 cursor-pointer rounded-lg p-2 my-1">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden border border-white/10 shrink-0">
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-white text-sm line-clamp-1">{p.name}</span>
                                  <span className="text-xs text-emerald-400">${p.price}</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedProduct && (
                        <div className="flex items-center gap-3 p-3 mt-2 rounded-xl bg-purple-500/5 border border-purple-500/20">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                          <span className="text-xs text-zinc-300 font-medium leading-relaxed">
                            Reviewing: <strong className="text-white">{selectedProduct.name}</strong>
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Community Select */}
                <div className="space-y-3">
                  <Label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                    Post to Community <span className="text-red-400">*</span>
                  </Label>
                  {noCommunities ? (
                    <div className="flex flex-col justify-center bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-400 font-medium text-sm mb-1">
                        <AlertCircle className="w-4 h-4" /> No communities found
                      </div>
                      <p className="text-xs text-zinc-500">Create a community first to post reviews.</p>
                      <Button
                        variant="ghost"
                        onClick={() => router.push("/expert/communities/new")}
                        className="text-xs p-0 h-auto text-purple-400 justify-start mt-2 hover:bg-transparent hover:text-purple-300"
                      >
                        Create Community &rarr;
                      </Button>
                    </div>
                  ) : (
                    <Select value={communityId} onValueChange={setCommunityId}>
                      <SelectTrigger className="w-full bg-[#0a0a0c] border-white/[0.1] h-14 rounded-xl text-left focus:ring-1 focus:ring-purple-500/50">
                        <SelectValue placeholder="Select one of your communities..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111] border-white/[0.1] max-h-[300px]">
                        {communities.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="focus:bg-white/5 cursor-pointer rounded-lg p-2 my-1">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden border border-white/10 shrink-0 flex items-center justify-center">
                                {c.imageUrl ? (
                                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-black text-zinc-500">{c.name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-white text-sm line-clamp-1">{c.name}</span>
                                <span className="text-xs text-zinc-500">{c.memberCount || 0} Members</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-3 pt-4 border-t border-white/[0.04]">
                <Label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                  Catchy Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="Write a powerful title that grabs attention..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={blocked}
                  className="bg-transparent border-0 border-b border-white/10 rounded-none px-0 h-14 text-2xl font-bold placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:border-purple-500 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Rating */}
              <div className="space-y-3 pt-4">
                <Label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">Expert Rating</Label>
                <div className={`flex items-center gap-6 p-4 rounded-xl bg-[#0a0a0c] border border-white/[0.06] w-fit ${blocked ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star className={`w-8 h-8 ${rating >= star ? "fill-yellow-500 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" : "text-zinc-700"}`} />
                      </button>
                    ))}
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <span className="text-sm font-bold w-20 text-white">
                    {rating === 1 && "Poor 😞"}
                    {rating === 2 && "Fair 😐"}
                    {rating === 3 && "Good 🙂"}
                    {rating === 4 && "Great 😃"}
                    {rating === 5 && "Excellent 🤩"}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Deep-Dive Review */}
          <Card className="bg-[#111] border-white/[0.06] rounded-2xl">
            <CardHeader className="border-b border-white/[0.04] pb-4">
              <CardTitle className="text-lg">Deep-Dive Review <span className="text-red-400">*</span></CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Textarea
                placeholder="Share your full experience, unboxing thoughts, performance metrics, and final verdict..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={blocked}
                className="bg-[#0a0a0c] border-white/[0.1] min-h-[250px] resize-y text-base p-4 focus-visible:ring-1 focus-visible:ring-purple-500/50 leading-relaxed disabled:opacity-50"
              />
            </CardContent>
          </Card>

          {/* Media Upload */}
          <Card className="bg-[#111] border-white/[0.06] rounded-2xl">
            <CardHeader className="border-b border-white/[0.04] pb-4">
              <CardTitle className="text-lg">Media & Gallery</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className={`relative border-2 border-dashed border-white/10 hover:border-purple-500/50 rounded-2xl p-10 text-center bg-[#0a0a0c] transition-colors group ${blocked ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/quicktime"
                  onChange={handleMediaChange}
                  disabled={blocked}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Drag & Drop Media</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                  Upload images and video clips to support your review. JPEGs, PNGs, WebP, and MP4s supported (max 50MB each).
                </p>
              </div>

              {mediaFiles.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaFiles.map((media, idx) => (
                    <div key={`${media.file.name}-${idx}`} className="relative group aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                      {media.file.type.startsWith("video") ? (
                        <video src={media.preview} className="w-full h-full object-cover">
                          <track kind="captions" />
                        </video>
                      ) : (
                        <img src={media.preview} alt="Upload preview" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={() => removeMedia(idx)}
                          className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="bg-[#111] border-white/[0.06] rounded-2xl">
            <CardHeader className="border-b border-white/[0.04] pb-4">
              <CardTitle className="text-lg">Tags</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className={`flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#0a0a0c] border border-white/[0.1] min-h-[56px] ${blocked ? "opacity-50 pointer-events-none" : ""}`}>
                {tags.map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium">
                    #{tag}
                    <button onClick={() => setTags(tags.filter((_, i) => i !== idx))} className="text-purple-400 hover:text-white ml-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <Input
                  placeholder="Add tags (press Enter)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  disabled={blocked}
                  className="bg-transparent border-0 min-w-[200px] flex-1 focus-visible:ring-0 text-sm h-10 px-2"
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full lg:w-[350px] space-y-6">

          <Card className="bg-[#111] border-white/[0.06] rounded-2xl sticky top-24 z-30">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting || blocked}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-12 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Review"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || blocked}
                  className="w-full border-white/10 hover:bg-white/5 font-bold h-12 rounded-xl text-zinc-300 disabled:opacity-50"
                >
                  Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
    </div>
  );
}
