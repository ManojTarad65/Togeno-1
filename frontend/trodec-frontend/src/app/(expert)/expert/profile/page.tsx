"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { getJoinedCommunities } from "@/services/communities.service";
import type { Community, CommunityMember } from "@/services/communities.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Shield,
  Activity,
  Camera,
  Star,
  Save,
  Trash2,
  CheckCircle2,
  Crown,
  Users,
  Award,
  Briefcase,
  Calendar,
  Tag,
  Warehouse,
  MapPin,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAddresses,
  getWarehouseAddress,
  setWarehouseAddress,
  createAddress,
  Address,
} from "@/services/address.service";
import api from "@/services/api";

interface MembershipWithCommunity {
  membership: CommunityMember;
  community: Community;
}

export default function ExpertProfilePage() {
  const { user, profile, expertDetails } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [clothingSizes, setClothingSizes] = useState<Record<string, string>>({
    clothing: "",
    bottoms: "",
    shoes: "",
  });
  const [savingSizes, setSavingSizes] = useState(false);
  const [memberships, setMemberships] = useState<MembershipWithCommunity[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [warehouseAddress, setWarehouseAddressState] = useState<Address | null>(null);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddr, setNewAddr] = useState({ fullName: "", phoneNumber: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India" });

  useEffect(() => {
    getJoinedCommunities({ limit: 50 })
      .then((res) => setMemberships(res.data))
      .catch(() => {});
    getAddresses().then(setAddresses).catch(() => {});
    getWarehouseAddress().then(setWarehouseAddressState).catch(() => {});
  }, []);

  useEffect(() => {
    if (expertDetails?.clothingSizes) {
      setClothingSizes((prev) => ({ ...prev, ...(expertDetails.clothingSizes as Record<string, string>) }));
    }
  }, [expertDetails]);

  async function handleSaveSizes() {
    setSavingSizes(true);
    try {
      const sizes: Record<string, string> = {};
      Object.entries(clothingSizes).forEach(([k, v]) => { if (v.trim()) sizes[k] = v.trim(); });
      await api.patch("/users/me/expert", { clothingSizes: sizes });
      toast.success("Size preferences saved");
    } catch {
      toast.error("Failed to save sizes");
    } finally {
      setSavingSizes(false);
    }
  }

  async function handleSetWarehouse(addressId: string) {
    setWarehouseLoading(true);
    try {
      const updated = await setWarehouseAddress(addressId);
      setWarehouseAddressState(updated);
      setAddresses((prev) => prev.map((a) => ({ ...a, isWarehouse: a.id === addressId })));
      toast.success("Warehouse address set. You are now eligible to receive brand pitches.");
    } catch {
      toast.error("Failed to set warehouse address");
    } finally {
      setWarehouseLoading(false);
    }
  }

  async function handleAddWarehouseAddress() {
    if (!newAddr.fullName || !newAddr.phoneNumber || !newAddr.addressLine1 || !newAddr.city || !newAddr.state || !newAddr.postalCode) {
      toast.error("Please fill all required fields");
      return;
    }
    setWarehouseLoading(true);
    try {
      const created = await createAddress(newAddr);
      const updated = await setWarehouseAddress(created.id);
      setWarehouseAddressState(updated);
      setAddresses((prev) => [...prev.map((a) => ({ ...a, isWarehouse: false })), updated]);
      setShowNewAddressForm(false);
      setNewAddr({ fullName: "", phoneNumber: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India" });
      toast.success("Warehouse address saved. You are now eligible to receive brand pitches.");
    } catch {
      toast.error("Failed to save warehouse address");
    } finally {
      setWarehouseLoading(false);
    }
  }

  const handleSave = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Profile updated successfully");
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 text-white pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expert Settings</h1>
        <p className="text-zinc-500">
          Manage your public profile and account preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-[#111111] border border-[#1a1a1a] p-1 rounded-xl flex-wrap gap-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-zinc-800">
            <User className="w-4 h-4 mr-2" /> General
          </TabsTrigger>
          <TabsTrigger value="sizes" className="data-[state=active]:bg-zinc-800">
            <Tag className="w-4 h-4 mr-2" /> Sizes
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="data-[state=active]:bg-zinc-800">
            <Warehouse className="w-4 h-4 mr-2" /> Warehouse
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
            <Activity className="w-4 h-4 mr-2" /> Activity
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-zinc-800">
            <Shield className="w-4 h-4 mr-2" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ================= WAREHOUSE TAB ================= */}
        {/* ── SIZES TAB ── */}
        <TabsContent value="sizes" className="space-y-6 mt-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" /> Size Preferences
              </CardTitle>
              <p className="text-sm text-zinc-500">
                Brands will see these when sending you product samples. They&apos;ll pre-fill the size they ship.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: "clothing", label: "Clothing / Top size", placeholder: "e.g. M, L, XL" },
                { key: "bottoms", label: "Bottoms / Pants size", placeholder: "e.g. 32, 34W×32L" },
                { key: "shoes", label: "Shoe size", placeholder: "e.g. UK 10, EU 44, US 11" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <Label className="text-zinc-400 text-sm mb-1 block">{label}</Label>
                  <Input
                    value={clothingSizes[key] ?? ""}
                    onChange={(e) => setClothingSizes((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="bg-[#111] border-[#1a1a1a] text-white max-w-xs"
                  />
                </div>
              ))}
              <div className="pt-2">
                <Button
                  onClick={handleSaveSizes}
                  disabled={savingSizes}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {savingSizes ? <><span className="animate-spin mr-2">⟳</span>Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Sizes</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse" className="space-y-6 mt-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-500" />
                Warehouse Address
              </CardTitle>
              <p className="text-sm text-zinc-500 mt-1">
                Set a warehouse address where brands will ship product samples for you to review. You must have a warehouse address to receive brand pitches.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {warehouseAddress ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-semibold text-sm mb-1">Warehouse configured</p>
                    <p className="text-zinc-300 text-sm">{warehouseAddress.fullName}</p>
                    <p className="text-zinc-400 text-sm">{warehouseAddress.addressLine1}{warehouseAddress.addressLine2 ? `, ${warehouseAddress.addressLine2}` : ""}</p>
                    <p className="text-zinc-400 text-sm">{warehouseAddress.city}, {warehouseAddress.state} – {warehouseAddress.postalCode}</p>
                    <p className="text-zinc-400 text-sm">{warehouseAddress.country}</p>
                    <p className="text-zinc-500 text-xs mt-1">Phone: {warehouseAddress.phoneNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-amber-300 text-sm">No warehouse address set. You cannot receive brand pitches until you configure one.</p>
                </div>
              )}

              {addresses.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-sm">Select from your saved addresses</Label>
                  {addresses.map((addr) => (
                    <div key={addr.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${addr.isWarehouse ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#1a1a1a] bg-[#111111]"}`}>
                      <div>
                        <p className="text-white text-sm font-medium">{addr.fullName}</p>
                        <p className="text-zinc-500 text-xs">{addr.addressLine1}, {addr.city}, {addr.state} {addr.postalCode}</p>
                      </div>
                      {addr.isWarehouse ? (
                        <span className="text-xs text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded-full">Active</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-7"
                          disabled={warehouseLoading}
                          onClick={() => handleSetWarehouse(addr.id)}
                        >
                          Use as Warehouse
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-[#1a1a1a]">
                {!showNewAddressForm ? (
                  <Button
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
                    onClick={() => setShowNewAddressForm(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add New Address
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-zinc-400 text-sm">New Warehouse Address</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs text-zinc-500">Full Name *</Label>
                        <Input value={newAddr.fullName} onChange={(e) => setNewAddr(p => ({ ...p, fullName: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-zinc-500">Phone *</Label>
                        <Input value={newAddr.phoneNumber} onChange={(e) => setNewAddr(p => ({ ...p, phoneNumber: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-zinc-500">Address Line 1 *</Label>
                        <Input value={newAddr.addressLine1} onChange={(e) => setNewAddr(p => ({ ...p, addressLine1: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-zinc-500">Address Line 2</Label>
                        <Input value={newAddr.addressLine2} onChange={(e) => setNewAddr(p => ({ ...p, addressLine2: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">City *</Label>
                        <Input value={newAddr.city} onChange={(e) => setNewAddr(p => ({ ...p, city: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">State *</Label>
                        <Input value={newAddr.state} onChange={(e) => setNewAddr(p => ({ ...p, state: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Postal Code *</Label>
                        <Input value={newAddr.postalCode} onChange={(e) => setNewAddr(p => ({ ...p, postalCode: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Country</Label>
                        <Input value={newAddr.country} onChange={(e) => setNewAddr(p => ({ ...p, country: e.target.value }))} className="bg-[#111] border-[#1a1a1a] text-white mt-1" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        disabled={warehouseLoading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                        onClick={handleAddWarehouseAddress}
                      >
                        {warehouseLoading ? "Saving..." : "Save as Warehouse"}
                      </Button>
                      <Button variant="ghost" className="text-zinc-500" onClick={() => setShowNewAddressForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= GENERAL TAB ================= */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border border-[#1a1a1a]">
  <AvatarImage
    src={
      profile?.avatarUrl
        ? profile.avatarUrl
        : (user as any)?.photoURL
        ? (user as any).photoURL
        : undefined
    }
    alt="Profile"
  />
  <AvatarFallback className="bg-zinc-900 text-zinc-400 text-2xl">
    {profile?.fullName?.charAt(0)?.toUpperCase() ||
      user?.email?.charAt(0)?.toUpperCase() ||
      "E"}
  </AvatarFallback>
</Avatar>

                  <button className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 rounded-full text-white border-2 border-[#0b0b0b] hover:bg-emerald-500">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">
                      {profile?.fullName || "Expert"}
                    </h3>
                    {expertDetails?.isVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified Expert
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    Google photo auto appears if signed in via Google.
                  </p>
                </div>
              </div>

              {/* Credibility Strip */}
              {expertDetails && (
                <div className="rounded-xl border border-[#1a1a1a] bg-[#0e0e0e] p-4 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    <Award className="w-3.5 h-3.5 text-emerald-500" />
                    Expert Credibility
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Verified Status */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Status</span>
                      {expertDetails.isVerified ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-yellow-500 text-sm font-semibold">Pending</span>
                      )}
                    </div>

                    {/* Rating */}
                    {expertDetails.rating > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Rating</span>
                        <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
                          <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400 shrink-0" />
                          {expertDetails.rating.toFixed(1)}
                          <span className="text-zinc-500 font-normal text-xs">({expertDetails.totalReviews})</span>
                        </span>
                      </div>
                    )}

                    {/* Communities */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Communities</span>
                      <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
                        <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        {memberships.length}
                      </span>
                    </div>

                    {/* Years of Experience */}
                    {expertDetails.yearsOfExperience !== null && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Experience</span>
                        <span className="flex items-center gap-1.5 text-white text-sm font-semibold">
                          <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          {expertDetails.yearsOfExperience}y
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expertise Tags */}
                  {expertDetails.expertise?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Expertise
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {expertDetails.expertise.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Member since */}
                  {profile?.createdAt && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                      <Calendar className="w-3 h-3" />
                      Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    defaultValue={profile?.fullName || ""}
                    className="bg-[#111111] border-[#1a1a1a]"
                  />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    disabled
                    defaultValue={user?.email || ""}
                    className="bg-[#0e0e0e] border-[#1a1a1a] text-zinc-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Bio</Label>
                  <Input
                    placeholder="Tell people about your expertise..."
                    className="bg-[#111111] border-[#1a1a1a]"
                  />
                </div>

                <div>
                  <Label>Specialization</Label>
                  <Input
                    placeholder="e.g. Tech Reviews"
                    className="bg-[#111111] border-[#1a1a1a]"
                  />
                </div>

                <div>
                  <Label>Website / Social Link</Label>
                  <Input
                    placeholder="https://..."
                    className="bg-[#111111] border-[#1a1a1a]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="h-9 text-sm bg-white text-black hover:bg-zinc-200 font-medium"
                >
                  {isLoading ? "Saving..." : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ACTIVITY TAB ================= */}
        <TabsContent value="activity" className="space-y-6 mt-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a] p-6">
            <h2 className="text-lg font-semibold mb-6">Your Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Communities" value={String(memberships.length || "0")} />
              <StatCard
                title="Reviews"
                value={String(expertDetails?.totalReviews ?? "—")}
              />
              <StatCard
                title="Avg Rating"
                value={expertDetails?.rating ? expertDetails.rating.toFixed(1) : "—"}
                icon={!!expertDetails?.rating}
              />
              <StatCard
                title="Experience"
                value={expertDetails?.yearsOfExperience ? `${expertDetails.yearsOfExperience}y` : "—"}
              />
            </div>
          </Card>

          {/* Communities Section */}
          <Card className="bg-[#0b0b0b] border-[#1a1a1a] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Your Communities</h2>
              {memberships.length > 0 && (
                <span className="text-xs text-zinc-500 font-medium">{memberships.length} joined</span>
              )}
            </div>

            {memberships.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <Users className="w-8 h-8 text-zinc-700" />
                <p className="text-zinc-500 text-sm">You haven't joined any communities yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map(({ membership, community }) => (
                  <div
                    key={community.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-[#111111] border border-[#1a1a1a] hover:border-zinc-700 transition-colors"
                  >
                    {/* Community icon */}
                    <div className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                      {community.imageUrl ? (
                        <img
                          src={community.imageUrl}
                          alt={community.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">
                          {community.name}
                        </span>
                        {membership.isExpert && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wide shrink-0">
                            <Crown className="w-2.5 h-2.5" />
                            Expert
                          </span>
                        )}
                      </div>
                      {community.category?.name && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Tag className="w-2.5 h-2.5" />
                          {community.category.name}
                        </span>
                      )}
                    </div>

                    {/* Member count */}
                    <div className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                      <Users className="w-3 h-3 text-purple-400" />
                      {community.memberCount?.toLocaleString() ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ================= SECURITY TAB ================= */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card className="bg-[#0b0b0b] border-[#1a1a1a] p-6 space-y-6">
            <h2 className="text-lg font-semibold">Security Settings</h2>

            <Input
              type="password"
              placeholder="Current Password"
              className="bg-[#111111] border-[#1a1a1a]"
            />
            <Input
              type="password"
              placeholder="New Password"
              className="bg-[#111111] border-[#1a1a1a]"
            />
            <Input
              type="password"
              placeholder="Confirm Password"
              className="bg-[#111111] border-[#1a1a1a]"
            />

            <Button variant="outline">Update Password</Button>

            {/* Danger Zone */}
            <div className="border-t border-[#1a1a1a] pt-6 mt-6">
              <h3 className="text-red-400 font-semibold mb-2">
                Danger Zone
              </h3>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ===== Small Stats Component ===== */
function StatCard({ title, value, icon }: any) {
  return (
    <div className="bg-[#111111] border border-[#1a1a1a] p-5 rounded-xl">
      <div className="text-zinc-500 text-sm mb-2">{title}</div>
      <div className="text-2xl font-bold text-white flex items-center gap-2">
        {value}
        {icon && <Star className="w-4 h-4 text-orange-400" />}
      </div>
    </div>
  );
}
