"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { useSuperAdminAuth } from "@/lib/auth-context";
import { LoadingState } from "@/components/ui/States";

export default function SuperAdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSuperAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/super-admin/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <LoadingState label="Đang xác thực..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">Quản trị hệ thống</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
