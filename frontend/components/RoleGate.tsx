"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!allow.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-board-orange/30 bg-board-orange/[0.08] py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-board-orange-dark" />
        <p className="text-sm font-semibold text-board-orange-dark">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }
  return <>{children}</>;
}
