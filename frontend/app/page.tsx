"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField } from "@/components/ui/Input";
import { slugify } from "@/lib/utils";

export default function LandingPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function handleGoToSchool(e: FormEvent) {
    e.preventDefault();
    const normalized = slugify(slug);
    if (!normalized) return;
    router.push(`/${normalized}/login`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <BookMarked className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Hệ thống Thư viện Trường học</h1>
        <p className="mt-3 max-w-xl text-base text-slate-600">
          Nền tảng quản lý thư viện đa trường: mượn / trả sách, đặt trước, quản lý phạt và người dùng — mỗi trường có
          không gian dữ liệu riêng, truy cập qua địa chỉ riêng của trường mình.
        </p>

        <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Trường của bạn</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">Nhập mã trường để vào trang đăng nhập của trường.</p>
            <form onSubmit={handleGoToSchool}>
              <FormField>
                <Label htmlFor="school-slug">Mã trường (slug)</Label>
                <Input
                  id="school-slug"
                  placeholder="vd: truong_nguyensieu"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
              </FormField>
              <Button type="submit" className="w-full">
                Vào trang đăng nhập <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Trường mới</h2>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                Chưa có tài khoản? Đăng ký để đưa thư viện trường bạn lên hệ thống — sau khi gửi, quản trị hệ thống sẽ
                xem xét và phê duyệt.
              </p>
            </div>
            <Link href="/dang-ky">
              <Button variant="secondary" className="w-full">
                Đăng ký cho trường của bạn <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4 text-center">
        <Link
          href="/super-admin/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Đăng nhập quản trị hệ thống
        </Link>
      </footer>
    </div>
  );
}
