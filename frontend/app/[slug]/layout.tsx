"use client";

import { useParams } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Wraps both `/{slug}/login` and `/{slug}/(app)/*` with a tenant-scoped
 * AuthProvider so every page under this school knows which school it is.
 */
export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? "");

  return <AuthProvider slug={slug}>{children}</AuthProvider>;
}
