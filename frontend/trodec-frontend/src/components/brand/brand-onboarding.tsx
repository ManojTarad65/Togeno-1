"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBrandDetails, updateBrandDetails } from "@/services/brand.service";
import { useAuthStore } from "@/stores/auth.store";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    "Fashion",
    "Electronics",
    "Fitness",
    "Beauty",
    "Food",
    "Tech",
    "Home"
];

export function BrandOnboarding() {
    const router = useRouter();
    const { fetchCurrentUser, brandDetails, profile } = useAuthStore();

    const [loading, setLoading] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        brandName: "",
        description: "",
        targetAudience: "",
        websiteUrl: "",
    });

    const toggleCategory = (category: string) => {
        setSelectedCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const normaliseUrl = (raw: string): string | undefined => {
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (loading) return;

        const resolvedBrandName = formData.brandName.trim() || profile?.fullName?.trim() || "";
        if (!resolvedBrandName || resolvedBrandName.length < 2) {
            toast.error("Please enter your brand name (at least 2 characters).");
            return;
        }

        if (selectedCategories.length === 0) {
            toast.error("Please select at least one brand category.");
            return;
        }

        if (!formData.description.trim()) {
            toast.error("Please provide a brand description.");
            return;
        }

        const websiteUrl = normaliseUrl(formData.websiteUrl);
        if (formData.websiteUrl.trim() && websiteUrl) {
            try {
                new URL(websiteUrl);
            } catch {
                toast.error("Please enter a valid website URL.");
                return;
            }
        }

        setLoading(true);

        try {
            const combinedDescription = formData.targetAudience.trim()
                ? `${formData.description.trim()}\n\nTarget Audience: ${formData.targetAudience.trim()}`
                : formData.description.trim();

            const payload = {
                businessType: selectedCategories.join(", "),
                description: combinedDescription,
                websiteUrl,
            };

            if (brandDetails) {
                await updateBrandDetails(payload);
            } else {
                await createBrandDetails({ brandName: resolvedBrandName, ...payload });
            }

            await fetchCurrentUser();

            toast.success("Welcome aboard! Onboarding complete.");
            router.replace("/brand/dashboard");
        } catch (error: unknown) {
            console.error("Onboarding error:", error);
            const message = error instanceof Error ? error.message : "Failed to save onboarding details";
            toast.error(message);
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl bg-[#0b0b0b] border-[#1f1f1f] text-white">
            <CardContent className="p-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-2">Tell us about your brand</h1>
                    <p className="text-zinc-400">
                        Complete your profile to get the most out of Trodec and connect with experts.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Brand Name */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300">
                            Brand Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            name="brandName"
                            placeholder={profile?.fullName ?? "Your brand name"}
                            value={formData.brandName}
                            onChange={handleChange}
                            className="bg-[#111] border-[#1f1f1f] focus:border-purple-500"
                        />
                    </div>

                    {/* Categories */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300">
                            Select Categories <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {CATEGORIES.map((category) => {
                                const isSelected = selectedCategories.includes(category);
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => toggleCategory(category)}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3 border rounded-xl transition-all duration-200 text-sm font-medium",
                                            isSelected
                                                ? "bg-purple-500/10 border-purple-500 text-purple-400"
                                                : "bg-[#111] border-[#1f1f1f] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                        )}
                                    >
                                        {category}
                                        {isSelected && <Check className="w-4 h-4 ml-2 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300">
                            Brand Description <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            name="description"
                            placeholder="What makes your brand unique?"
                            value={formData.description}
                            onChange={handleChange}
                            className="bg-[#111] border-[#1f1f1f] min-h-[100px] resize-none focus:border-purple-500"
                        />
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300">
                            Target Audience
                        </label>
                        <Input
                            name="targetAudience"
                            placeholder="e.g., Gen Z, Tech Enthusiasts, Fitness Lovers..."
                            value={formData.targetAudience}
                            onChange={handleChange}
                            className="bg-[#111] border-[#1f1f1f] focus:border-purple-500"
                        />
                    </div>

                    {/* Website / Social Link */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-300">
                            Website / Social Link
                        </label>
                        <Input
                            name="websiteUrl"
                            placeholder="https://yourbrand.com"
                            value={formData.websiteUrl}
                            onChange={handleChange}
                            className="bg-[#111] border-[#1f1f1f] focus:border-purple-500"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base font-semibold"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                            "Complete Onboarding"
                        )}
                    </Button>

                </form>
            </CardContent>
        </Card>
    );
}
