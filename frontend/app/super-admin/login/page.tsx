"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useSuperAdminAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField } from "@/components/ui/Input";

export default function SuperAdminLoginPage() {
  const { login } = useSuperAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/super-admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối tới máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-system-ink px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-board-blue-dark text-paper-white shadow-pin">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-paper-white">Quản trị hệ thống</h1>
          <p className="mt-1 text-sm text-paper-white/60">Đăng nhập tài khoản super admin</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-paper-white/10 bg-system-ink-soft p-6 shadow-pin-lg">
          {error && (
            <div className="mb-4 rounded-lg border-2 border-board-brick/40 bg-board-brick/15 px-3 py-2 text-sm font-medium text-[#ffb4a0]">
              {error}
            </div>
          )}
          <FormField>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-paper-white/85">
              Email <span className="ml-0.5 text-board-brick">*</span>
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-paper-white/15 bg-system-ink text-paper-white placeholder:text-paper-white/30 focus:border-board-blue"
            />
          </FormField>
          <FormField>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-paper-white/85">
              Mật khẩu <span className="ml-0.5 text-board-brick">*</span>
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-paper-white/15 bg-system-ink text-paper-white placeholder:text-paper-white/30 focus:border-board-blue"
            />
          </FormField>
          <Button type="submit" className="w-full" loading={loading} size="lg">
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
