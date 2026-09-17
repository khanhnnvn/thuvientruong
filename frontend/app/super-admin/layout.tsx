"use client";

import { SuperAdminAuthProvider } from "@/lib/auth-context";

/** Wraps both `/super-admin/login` and the dashboard with the super_admin-only auth context. */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminAuthProvider>{children}</SuperAdminAuthProvider>;
}
