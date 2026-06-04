"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Megaphone } from "lucide-react";
import { toast } from "sonner";
import {
  createPitch,
  getBrandProducts,
  getCommunities,
} from "@/services";
import api from "@/services/api";

function NewPitchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCommunityId = searchParams.get("communityId") ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [products, setProducts] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [experts, setExperts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    productId: "",
    communityId: preselectedCommunityId,
    expertId: "",
    message: "",
    selectedSize: "",
  });
  const [expertClothingSizes, setExpertClothingSizes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoadingData(true);
      const [productsRes, communitiesRes] = await Promise.all([
        getBrandProducts(),
        getCommunities(),
      ]);
      setProducts(productsRes.data);
      const allCommunities = communitiesRes.data;
      setCommunities(allCommunities);

      // Auto-populate expert when communityId came from query params
      if (preselectedCommunityId) {
        const selected = allCommunities.find((c: any) => c.id === preselectedCommunityId);
        const creator = selected?.creator;
        if (creator?.id) {
          setExperts([{
            id: creator.id,
            full_name: creator.full_name ?? null,
            email: creator.email ?? "",
          }]);
        }
      }
    } catch {
      toast.error("Failed to load form data");
    } finally {
      setLoadingData(false);
    }
  }

  async function handleCommunityChange(id: string) {
    setFormData((prev) => ({ ...prev, communityId: id, expertId: "", selectedSize: "" }));
    setExperts([]);
    setExpertClothingSizes({});

    if (!id) return;

    const selected = communities.find((c) => c.id === id);
    const creator = selected?.creator;
    if (creator?.id) {
      setExperts([{ id: creator.id, full_name: creator.full_name ?? null, email: creator.email ?? "" }]);
      setFormData((prev) => ({ ...prev, communityId: id, expertId: creator.id, selectedSize: "" }));
      // Fetch expert's clothing sizes
      try {
        const resp = await api.get<any>(`/users/${creator.id}/expert-details`);
        const sizes = resp.data?.data?.clothingSizes ?? {};
        setExpertClothingSizes(sizes);
      } catch {
        // non-critical
      }
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "communityId") {
      handleCommunityChange(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.productId || !formData.communityId || !formData.expertId) {
      toast.error("Select product, community & expert");
      return;
    }

    try {
      setIsLoading(true);

      await createPitch({
        productId: formData.productId,
        communityId: formData.communityId,
        expertId: formData.expertId,
        message: formData.message || undefined,
        selectedSize: formData.selectedSize || null,
      });

      toast.success("Pitch created successfully");
      router.push("/brand/pitches");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create pitch");
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const expertPlaceholder = formData.communityId
    ? experts.length === 0 ? "No expert assigned to this community" : "Select expert"
    : "Select community first";

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 text-white space-y-8">

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
          <h1 className="text-2xl font-semibold tracking-tight">Create New Pitch</h1>
          <p className="text-sm text-zinc-400">Send a collaboration proposal to an expert</p>
        </div>
      </div>

      <Card className="bg-[#0b0b0b] border border-[#1f1f1f]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-purple-400" />
            Pitch Details
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Product */}
            <div>
              <label htmlFor="productId" className="text-sm text-zinc-400 mb-2 block">Product *</label>
              {products.length === 0 ? (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-amber-400 font-medium">You have no products yet.</p>
                  <p className="text-xs text-zinc-500">Create a product first before sending a pitch to an expert.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/brand/products/new")}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Create a Product →
                  </button>
                </div>
              ) : (
                <select
                  id="productId"
                  name="productId"
                  value={formData.productId}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#111111] border border-[#1f1f1f] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ${p.price}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Community */}
            <div>
              <label htmlFor="communityId" className="text-sm text-zinc-400 mb-2 block">Community *</label>
              <select
                id="communityId"
                name="communityId"
                value={formData.communityId}
                onChange={handleChange}
                required
                className="w-full bg-[#111111] border border-[#1f1f1f] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="">Select community</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Expert */}
            <div>
              <label htmlFor="expertId" className="text-sm text-zinc-400 mb-2 block">Expert *</label>
              <select
                id="expertId"
                name="expertId"
                value={formData.expertId}
                onChange={handleChange}
                required
                disabled={!formData.communityId}
                className="w-full bg-[#111111] border border-[#1f1f1f] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 disabled:opacity-40"
              >
                <option value="">{expertPlaceholder}</option>
                {experts.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.full_name || expert.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Size picker — only shown when selected product has sizes */}
            {(() => {
              const selectedProduct = products.find((p) => p.id === formData.productId);
              const availableSizes: string[] = selectedProduct?.metadata?.attributes?.sizes ?? selectedProduct?.metadata?.sizes ?? [];
              if (availableSizes.length === 0) return null;

              // Try to guess expert's preferred size from their clothing_sizes
              const expertPreferred =
                expertClothingSizes["clothing"] ||
                expertClothingSizes["top"] ||
                expertClothingSizes["size"] ||
                Object.values(expertClothingSizes)[0] ||
                "";

              return (
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">
                    Sample Size *
                    {expertPreferred && (
                      <span className="ml-2 text-emerald-400 text-xs">
                        Expert prefers: {expertPreferred}
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, selectedSize: size }))}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          formData.selectedSize === size
                            ? "bg-purple-600 border-purple-500 text-white"
                            : size === expertPreferred
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                              : "bg-[#111] border-[#1f1f1f] text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {size}
                        {size === expertPreferred && formData.selectedSize !== size && (
                          <span className="ml-1 text-[10px]">★</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {expertPreferred && !formData.selectedSize && (
                    <p className="text-xs text-zinc-600 mt-1.5">★ = expert&apos;s preferred size</p>
                  )}
                </div>
              );
            })()}

            {/* Message */}
            <div>
              <label htmlFor="message" className="text-sm text-zinc-400 mb-2 block">Message</label>
              <Textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                className="bg-[#111111] border border-[#1f1f1f] text-white min-h-25"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => router.back()} className="text-zinc-400 hover:text-white">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
                {isLoading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                  : "Send Pitch"}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewPitchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    }>
      <NewPitchForm />
    </Suspense>
  );
}
