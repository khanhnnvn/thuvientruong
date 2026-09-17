"use client";

import { useState, FormEvent, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookMarked, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField } from "@/components/ui/Input";

function LoginForm() {
  const { slug } = useParams<{ slug: string }>();
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginPath = `/${slug}/login`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      const next = searchParams.get("next");
      router.replace(next && next !== loginPath ? next : `/${slug}`);
      router.refresh();
      void user;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-board-blue-dark text-paper-white shadow-pin">
            <BookMarked className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Thư viện Trường học</h1>
          <p className="mt-1 text-sm text-ink-soft">Đăng nhập để quản lý mượn / trả sách</p>
          <p className="mt-3 inline-flex items-center rounded-full bg-board-blue/12 px-3 py-1 text-xs font-bold uppercase tracking-wide text-board-blue-dark">
            Mã trường: {slug}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-ink/12 bg-paper-white p-6 shadow-pin-lg">
          {error && (
            <div className="mb-4 rounded-lg border-2 border-board-brick/25 bg-board-brick/[0.06] px-3 py-2 text-sm font-medium text-board-brick-dark">
              {error}
            </div>
          )}
          <FormField>
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="ten@truong.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>
          <FormField>
            <Label htmlFor="password" required>
              Mật khẩu
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormField>
          <Button type="submit" className="w-full" loading={loading} size="lg">
            Đăng nhập
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} Thư viện Trường học. Liên hệ thủ thư nếu quên mật khẩu.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper">
          <Loader2 className="h-6 w-6 animate-spin text-board-blue-dark" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
