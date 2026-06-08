"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore, useAuthHydrated } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Megaphone,
  ShoppingBag,
  User,
  LogOut,
  Loader2,
  Menu,
  X,
  Users,
  Receipt,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutConfirmModal } from "@/components/ui/logout-confirm-modal";
import { motion, AnimatePresence } from "framer-motion";

const sidebarItems = [
  { href: "/brand/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand/communities", label: "Communities", icon: Users },
  { href: "/brand/products", label: "Products", icon: Package },
  { href: "/brand/pitches", label: "Pitches", icon: Megaphone },
  { href: "/brand/orders", label: "Orders", icon: ShoppingBag },
  { href: "/brand/earnings", label: "Earnings", icon: Wallet },
  { href: "/brand/invoices", label: "Invoices", icon: Receipt },
  { href: "/brand/profile", label: "Profile", icon: User },
];

/* Mobile bottom bar items (max 5) */
const mobileNavItems = [
  { href: "/brand/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/brand/products", label: "Products", icon: Package },
  { href: "/brand/pitches", label: "Pitches", icon: Megaphone },
  { href: "/brand/orders", label: "Orders", icon: ShoppingBag },
  { href: "/brand/profile", label: "Profile", icon: User },
];

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, profile, brandDetails, isAuthenticated, fetchCurrentUser, signOut } =
    useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  /* Close sidebar on route change */
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  /* Lock body scroll when sidebar open */
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!hydrated) return;
    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) { router.push("/login?redirect=/brand/dashboard"); return; }
      if (useAuthStore.getState().isAuthenticated) {
        // Fresh sign-in: brandDetails not yet loaded — fetch them now so the
        // onboarding gate and brand-specific UI have the data they need.
        if (!useAuthStore.getState().brandDetails) {
          await fetchCurrentUser();
        }
        setIsChecking(false);
        return;
      }
      await fetchCurrentUser();
      if (!useAuthStore.getState().isAuthenticated) { router.push("/login?redirect=/brand/dashboard"); return; }
      setIsChecking(false);
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!isChecking && profile) {
      const role = profile.role;
      if (role !== "brand_admin" && role !== "admin") {
        const roleRoutes: Record<string, string> = {
          consumer: "/consumer/dashboard",
          expert: "/expert/dashboard",
        };
        router.push(roleRoutes[role] ?? "/consumer/dashboard");
      }
    }
  }, [isChecking, profile, router]);

  const onboardingComplete = Boolean(
    brandDetails?.businessType && brandDetails?.description
  );
  const isOnboardingPage = pathname === "/brand/onboarding";

  /* Onboarding check */
  useEffect(() => {
    if (!isChecking && isAuthenticated && brandDetails) {
      if (!onboardingComplete && !isOnboardingPage) router.push("/brand/onboarding");
      else if (onboardingComplete && isOnboardingPage) router.push("/brand/dashboard");
    }
  }, [isChecking, isAuthenticated, brandDetails, onboardingComplete, isOnboardingPage, router]);

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    await signOut();
    router.push("/login");
  };

  // Block rendering for non-brand roles while the redirect above completes,
  // so brand-only content / fetches don't fire under the wrong account.
  const wrongRoleForBrand = Boolean(
    profile && profile.role !== "brand_admin" && profile.role !== "admin"
  );

  if (!hydrated || isChecking || !isAuthenticated || wrongRoleForBrand) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  /* Onboarding page renders without the sidebar chrome so the brand can
     complete their details before the verification gate kicks in. */
  if (isOnboardingPage) {
    return <>{children}</>;
  }

  /* Unverified brand gate — only after onboarding is done. New brands first
     need to fill in their business details (handled above) before they see
     the pending-approval screen. */
  if (brandDetails && onboardingComplete && !brandDetails.isVerified) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto border border-purple-500/20">
            <Package className="h-7 w-7 text-purple-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Pending Approval</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Your brand account is awaiting admin verification. You'll get full access once approved.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-red-400"
            onClick={async () => { await signOut(); router.push("/login"); }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex">

      {/* ── MOBILE SIDEBAR BACKDROP ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[240px] bg-[#0b0b0b] border-r border-[#1a1a1a] flex flex-col",
          "transform transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#1a1a1a] shrink-0">
          <Link href="/brand/dashboard" className="flex items-center gap-3 group">
            <div className="relative h-8 w-8 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Trodec Logo"
                width={32}
                height={32}
                className="object-contain group-hover:scale-105 transition-transform duration-200"
                priority
              />
            </div>
            <span className="text-sm font-bold tracking-wide text-white group-hover:text-emerald-400 transition-colors duration-200">
              TRODEC
            </span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-0.5">
          <p className="px-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
            Platform
          </p>

          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all relative",
                  isActive
                    ? "bg-white/[0.05] text-white"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-emerald-500 rounded-r-full" />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-emerald-500" : "text-zinc-600 group-hover:text-zinc-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Brand Identity + Logout */}
        <div className="p-4 border-t border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#111] shrink-0">
              {brandDetails?.logoUrl ? (
                <Image
                  src={brandDetails.logoUrl}
                  alt={brandDetails.brandName ?? "Brand"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                  <span className="text-xs font-black text-emerald-400">
                    {(brandDetails?.brandName ?? profile?.fullName ?? "B").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {brandDetails?.brandName ?? profile?.fullName ?? "Brand Admin"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-zinc-500 hover:text-red-400 hover:bg-red-500/5"
            onClick={() => setIsLogoutModalOpen(true)}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-h-screen overflow-auto flex flex-col lg:ml-[240px]">

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0b0b0b]/90 backdrop-blur-xl border-b border-[#1a1a1a] px-4 h-14 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-9 w-9 flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="text-sm font-bold text-white tracking-wide">Brand Panel</span>

          {/* Brand avatar */}
          <div className="h-8 w-8 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#111] shrink-0">
            {brandDetails?.logoUrl ? (
              <Image
                src={brandDetails.logoUrl}
                alt={brandDetails.brandName ?? "Brand"}
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <span className="text-xs font-black text-emerald-400">
                  {(brandDetails?.brandName ?? profile?.fullName ?? "B").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1600px] w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-t border-white/[0.08] pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                  isActive ? "text-white" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-emerald-400")} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="brand-mobile-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-400 rounded-b-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}
