"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSlug } from "@/lib/api";
import { navForRole } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/types";
import { cn, displayName } from "@/lib/utils";
import { LoadingState } from "@/components/ui/States";
import { NotificationsMenu } from "@/components/NotificationsMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const slug = useSlug();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${slug}/login`);
    }
  }, [loading, user, router, slug]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return <LoadingState label="Đang xác thực..." />;
  }

  const items = navForRole(user.role, slug);

  return (
    <div className="flex min-h-screen bg-paper-light">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink/10 bg-paper transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-ink/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-board-blue-dark text-paper-white">
            <BookMarked className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight text-ink">Thư viện Trường học</p>
            <p className="mt-0.5 inline-flex max-w-full items-center truncate rounded bg-board-blue/12 px-1.5 py-0.5 text-xs font-semibold text-board-blue-dark">
              {slug}
            </p>
          </div>
          <button
            type="button"
            className="ml-auto rounded p-1 text-ink-soft hover:bg-ink/[0.06] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = pathname === item.href || (item.hrefSuffix !== "" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition-colors",
                  active
                    ? "bg-board-blue-dark text-paper-white shadow-pin-sm"
                    : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-board-green-dark text-sm font-bold text-paper-white">
              {displayName(user).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{displayName(user)}</p>
              <p className="truncate text-xs text-ink-soft">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-board-brick/10 hover:text-board-brick-dark"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink/10 bg-paper-light/95 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            className="rounded p-1.5 text-ink-soft hover:bg-ink/[0.06] lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <NotificationsMenu />
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
