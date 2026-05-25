"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Loader2,
  User,
  Lightbulb,
  TrendingUp,
  RefreshCw,
  Bell,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { LogoutConfirmModal } from "@/components/ui/logout-confirm-modal";
import { motion, AnimatePresence } from "framer-motion";

const sidebarItems = [
  { href: "/expert/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expert/communities", label: "Communities", icon: Users },
  { href: "/expert/posts", label: "Posts", icon: MessageSquare },
  { href: "/expert/pitches", label: "Pitches", icon: Lightbulb },
  { href: "/expert/earnings", label: "Earnings", icon: TrendingUp },
  { href: "/expert/profile", label: "Profile", icon: User },
];

/* Items visible in mobile bottom bar (max 5) */
const mobileNavItems = [
  { href: "/expert/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/expert/communities", label: "Community", icon: Users },
  { href: "/expert/posts", label: "Posts", icon: MessageSquare },
  { href: "/expert/pitches", label: "Pitches", icon: Lightbulb },
  { href: "/expert/profile", label: "Profile", icon: User },
];

export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthHydrated();
  const [isChecking, setIsChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const {
    user,
    profile,
    expertDetails,
    isAuthenticated,
    fetchCurrentUser,
    signOut,
  } = useAuthStore();

  const { unreadCount } = useNotifications();

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
      if (!token) { router.push("/login"); return; }
      if (useAuthStore.getState().isAuthenticated) {
        // Fresh sign-in: expertDetails not yet loaded — fetch them now so the
        // unverified-expert gate has the data it needs.
        if (!useAuthStore.getState().expertDetails) {
          await fetchCurrentUser();
        }
        setIsChecking(false);
        return;
      }
      await fetchCurrentUser();
      if (!useAuthStore.getState().isAuthenticated) { router.push("/login"); return; }
      setIsChecking(false);
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!isChecking && profile) {
      const role = profile.role;
      if (role !== "expert" && role !== "admin") {
        const roleRoutes: Record<string, string> = {
          consumer: "/consumer/dashboard",
          brand_admin: "/brand/dashboard",
        };
        router.push(roleRoutes[role] ?? "/consumer/dashboard");
      }
    }
  }, [isChecking, profile, router]);

  /* Once verified, the expert goes through a one-time onboarding flow:
     fill in bio/expertise → create first community → land on dashboard. */
  useEffect(() => {
    if (isChecking || !isAuthenticated) return;
    if (!expertDetails || !expertDetails.isVerified) return;
    if (!user?.id) return;
    if (typeof window === "undefined") return;

    const flagKey = `trodec-expert-onboarded-${user.id}`;
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(flagKey) === "1";
    } catch { /* private mode — treat as not-onboarded */ }

    // Consider profile ready if ANY non-default expert field is filled.
    // Checking only bio would wrongly redirect existing experts who skipped that field.
    const profileLooksReady = Boolean(
      expertDetails.bio ||
      (expertDetails.expertise && expertDetails.expertise.length > 0) ||
      expertDetails.yearsOfExperience ||
      expertDetails.linkedinUrl
    );
    if (profileLooksReady && !onboarded) {
      try { localStorage.setItem(flagKey, "1"); } catch { /* ignore */ }
      onboarded = true;
    }

    const onOnboarding = pathname === "/expert/onboarding";
    const onCreateCommunity = pathname === "/expert/communities/new";

    if (!onboarded && !onOnboarding) {
      router.push("/expert/onboarding");
    } else if (onboarded && onOnboarding && !onCreateCommunity) {
      router.push("/expert/communities/new");
    }
  }, [isChecking, isAuthenticated, expertDetails, user?.id, pathname, router]);

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    await signOut();
    router.push("/login");
  };

  // Block rendering for non-expert roles while the redirect above completes,
  // so expert-only content / fetches don't fire under the wrong account.
  const wrongRoleForExpert = Boolean(
    profile && profile.role !== "expert" && profile.role !== "admin"
  );

  if (!hydrated || isChecking || !isAuthenticated || wrongRoleForExpert) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  /* Unverified expert gate */
  if (expertDetails && !expertDetails.isVerified) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto border border-yellow-500/20">
            <Lightbulb className="h-7 w-7 text-yellow-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Pending Approval</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Your expert account is awaiting admin verification. You'll get full access once approved. This usually takes 1–2 business days.
          </p>
          <p className="text-xs text-zinc-600">
            Questions?{" "}
            <a href="mailto:officialtrodec@gmail.com" className="text-emerald-400 hover:underline">
              officialtrodec@gmail.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={async () => { setIsChecking(true); await fetchCurrentUser(); setIsChecking(false); }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh Status
            </Button>
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

      {/* ── DESKTOP + MOBILE DRAWER SIDEBAR ── */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-[240px] bg-[#0b0b0b] border-r border-[#1a1a1a] transform transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="h-16 flex items-center px-5 border-b border-[#1a1a1a] justify-between shrink-0">
            <span className="text-sm font-bold text-white tracking-wide">EXPERT PANEL</span>
            <Button
              variant="ghost"
              className="lg:hidden h-8 w-8 p-0 text-zinc-500"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-0.5">
            <p className="px-3 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Workspace
            </p>

            {sidebarItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <button
                  key={item.href}
                  onClick={() => { router.push(item.href); setSidebarOpen(false); }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all relative",
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
                </button>
              );
            })}

            {/* Notifications */}
            <button
              onClick={() => { router.push("/expert/notifications"); setSidebarOpen(false); }}
              className={cn(
                "group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all relative mt-0.5",
                pathname.startsWith("/expert/notifications")
                  ? "bg-white/[0.05] text-white"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]"
              )}
            >
              {pathname.startsWith("/expert/notifications") && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-emerald-500 rounded-r-full" />
              )}
              <div className="relative">
                <Bell
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    pathname.startsWith("/expert/notifications")
                      ? "text-emerald-500"
                      : "text-zinc-600 group-hover:text-zinc-400"
                  )}
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-emerald-500 text-black text-[8px] font-black px-0.5 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              Notifications
            </button>
          </div>

          {/* User + Sign Out */}
          <div className="p-4 border-t border-[#1a1a1a] shrink-0">
            <div className="mb-3">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.fullName ?? "Expert"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                {user?.email}
              </p>
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
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-h-screen overflow-auto flex flex-col">

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0b0b0b]/90 backdrop-blur-xl border-b border-[#1a1a1a] px-4 h-14 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            className="h-9 w-9 p-0 text-zinc-400"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <span className="text-sm font-bold text-white tracking-wide">
            Expert Panel
          </span>

          <button
            onClick={() => router.push("/expert/notifications")}
            className="relative h-9 w-9 flex items-center justify-center text-zinc-400 hover:text-white transition rounded-lg"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-emerald-500 text-black text-[8px] font-black px-0.5 leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
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
                    layoutId="expert-mobile-indicator"
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
