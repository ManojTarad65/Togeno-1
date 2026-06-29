"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { updateBrandDetails, getPickupSettings, ShiprocketPickupSettings } from "@/services/brand.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Shield,
  Camera,
  Save,
  Receipt,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function BrandProfilePage() {
  const { user, profile, brandDetails, fetchCurrentUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const [gstForm, setGstForm] = useState({
    gstNumber: "",
    businessName: "",
    registeredAddress: "",
    billingState: "",
    billingPincode: "",
    billingEmail: "",
    contactNumber: "",
    panNumber: "",
  });
  const [isSavingGst, setIsSavingGst] = useState(false);
  const [pickupSync, setPickupSync] = useState<ShiprocketPickupSettings | null>(null);

  useEffect(() => {
    getPickupSettings().then(setPickupSync).catch(console.error);

    // Pre-fill GST form from brandDetails
    if (brandDetails) {
      setGstForm({
        gstNumber: brandDetails.gstNumber ?? "",
        businessName: brandDetails.businessName ?? "",
        registeredAddress: brandDetails.registeredAddress ?? "",
        billingState: brandDetails.billingState ?? "",
        billingPincode: brandDetails.billingPincode ?? "",
        billingEmail: brandDetails.billingEmail ?? "",
        contactNumber: brandDetails.contactNumber ?? "",
        panNumber: brandDetails.panNumber ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Profile updated successfully");
    }, 1000);
  };

  const handleGstSave = async () => {
    try {
      setIsSavingGst(true);
      await updateBrandDetails({
        gstNumber: gstForm.gstNumber || null,
        businessName: gstForm.businessName || null,
        registeredAddress: gstForm.registeredAddress || null,
        billingState: gstForm.billingState || null,
        billingPincode: gstForm.billingPincode || null,
        billingEmail: gstForm.billingEmail || null,
        contactNumber: gstForm.contactNumber || null,
        panNumber: gstForm.panNumber || null,
      });
      await fetchCurrentUser();
      toast.success("Billing details saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save billing details");
    } finally {
      setIsSavingGst(false);
    }
  };

  const tabTriggerClass =
    "data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 gap-2 px-4 py-2 rounded-md transition-all duration-200 hover:text-zinc-200 hover:bg-white/5";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-zinc-400">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="general" onValueChange={setActiveTab}>
        <div className="bg-zinc-900/50 border border-white/5 p-1 rounded-xl mb-8 w-fit">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="general" className={tabTriggerClass}>
              <User className="h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="security" className={tabTriggerClass}>
              <Shield className="h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="billing" className={tabTriggerClass}>
              <Receipt className="h-4 w-4" /> Billing / GST
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* ================= GENERAL TAB ================= */}
            <TabsContent value="general" className="space-y-6">
              <Card className="bg-[#0b0b0b] border-[#1f1f1f]">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-white">
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your profile details.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8 pt-8">
                  {/* Avatar */}
                  <div className="flex items-center gap-6 group">
                    <div className="relative">
                     <Avatar className="h-24 w-24 border-2 border-[#1f1f1f] shadow-xl">
  <AvatarImage
    src={
      profile?.avatarUrl
        ? profile.avatarUrl
        : undefined
    }
    alt="Profile"
  />
  <AvatarFallback className="bg-zinc-900 text-zinc-400 text-2xl font-medium">
    {profile?.fullName?.[0]?.toUpperCase() ||
      user?.email?.[0]?.toUpperCase() ||
      "U"}
  </AvatarFallback>
</Avatar>


                      <button className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 rounded-full text-white shadow-lg border-2 border-[#0b0b0b] hover:bg-emerald-500">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-white font-medium text-lg">
                        Profile Picture
                      </h3>
                      <p className="text-sm text-zinc-500">
                        Google photo appears automatically if logged in via Google.
                      </p>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        defaultValue={profile?.fullName || ""}
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        disabled
                        defaultValue={user?.email || ""}
                        className="bg-[#0e0e0e] border-[#1f1f1f] text-zinc-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        defaultValue="Acme Inc."
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input
                        disabled
                        defaultValue="Brand Administrator"
                        className="bg-[#0e0e0e] border-[#1f1f1f] text-zinc-500"
                      />
                    </div>

                    </div>
                </CardContent>

                <CardFooter className="flex justify-end border-t border-white/5">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="h-9 text-sm bg-white text-black hover:bg-zinc-200 font-medium"
                  >
                    {isLoading ? "Saving..." : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Pickup Location — managed by admin */}
              <Card className="bg-[#0b0b0b] border-[#1f1f1f]">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    Shiprocket Pickup Location
                  </CardTitle>
                  <CardDescription>
                    Your pickup address for sample shipments is managed by the Trodec team.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {pickupSync === null ? (
                    <p className="text-sm text-zinc-600">Loading…</p>
                  ) : pickupSync.shiprocketPickupLocation ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-300">Assigned location:</span>
                      <span className="text-sm font-mono font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded">
                        {pickupSync.shiprocketPickupLocation}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-400/80">
                      No pickup location assigned yet. Contact your Trodec account manager to set one up.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ================= SECURITY TAB ================= */}
            <TabsContent value="security">
              <Card className="bg-[#0b0b0b] border-[#1f1f1f] p-6 space-y-6">
                <h2 className="text-white font-semibold text-lg">
                  Security Settings
                </h2>

                <div className="space-y-4 max-w-md">
                  <Input
                    type="password"
                    placeholder="Current Password"
                    className="bg-[#111111] border-[#1f1f1f] text-white"
                  />
                  <Input
                    type="password"
                    placeholder="New Password"
                    className="bg-[#111111] border-[#1f1f1f] text-white"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    className="bg-[#111111] border-[#1f1f1f] text-white"
                  />

                  <Button variant="outline">Update Password</Button>
                </div>
              </Card>
            </TabsContent>

            {/* ================= BILLING / GST TAB ================= */}
            <TabsContent value="billing">
              <Card className="bg-[#0b0b0b] border-[#1f1f1f]">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-white">Billing & GST Information</CardTitle>
                  <CardDescription>
                    Used on invoices generated from your orders. Required for GST-compliant billing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Business Name</Label>
                      <Input
                        value={gstForm.businessName}
                        onChange={(e) => setGstForm({ ...gstForm, businessName: e.target.value })}
                        placeholder="As per GST registration"
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">GST Number</Label>
                      <Input
                        value={gstForm.gstNumber}
                        onChange={(e) => setGstForm({ ...gstForm, gstNumber: e.target.value.toUpperCase() })}
                        placeholder="22AAAAA0000A1Z5"
                        className="bg-[#111111] border-[#1f1f1f] text-white font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">PAN Number</Label>
                      <Input
                        value={gstForm.panNumber}
                        onChange={(e) => setGstForm({ ...gstForm, panNumber: e.target.value.toUpperCase() })}
                        placeholder="AAAAA0000A"
                        className="bg-[#111111] border-[#1f1f1f] text-white font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Contact Number</Label>
                      <Input
                        value={gstForm.contactNumber}
                        onChange={(e) => setGstForm({ ...gstForm, contactNumber: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Billing Email</Label>
                      <Input
                        type="email"
                        value={gstForm.billingEmail}
                        onChange={(e) => setGstForm({ ...gstForm, billingEmail: e.target.value })}
                        placeholder="billing@yourbrand.com"
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">State</Label>
                      <Input
                        value={gstForm.billingState}
                        onChange={(e) => setGstForm({ ...gstForm, billingState: e.target.value })}
                        placeholder="Maharashtra"
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Pincode</Label>
                      <Input
                        value={gstForm.billingPincode}
                        onChange={(e) => setGstForm({ ...gstForm, billingPincode: e.target.value })}
                        placeholder="400001"
                        className="bg-[#111111] border-[#1f1f1f] text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Registered Address</Label>
                    <Input
                      value={gstForm.registeredAddress}
                      onChange={(e) => setGstForm({ ...gstForm, registeredAddress: e.target.value })}
                      placeholder="Full registered business address"
                      className="bg-[#111111] border-[#1f1f1f] text-white"
                    />
                  </div>
                  <Button
                    onClick={handleGstSave}
                    disabled={isSavingGst}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {isSavingGst ? (
                      <><Save className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Save Billing Details</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
