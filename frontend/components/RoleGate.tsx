"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!allow.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-semibold text-amber-800">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }
  return <>{children}</>;
}
