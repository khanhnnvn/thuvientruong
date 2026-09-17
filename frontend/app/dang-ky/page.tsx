"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetchPublic, ApiError } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, FormField } from "@/components/ui/Input";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";

export default function SchoolRegisterPage() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Đã gửi đăng ký</h1>
          <p className="mt-2 text-sm text-slate-600">
            Yêu cầu đăng ký trường của bạn đã được ghi nhận. Vui lòng chờ quản trị hệ thống xem xét và phê duyệt —
            bạn sẽ có thể đăng nhập ngay sau khi trường được duyệt.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return <RegisterForm onSubmitted={() => setSubmitted(true)} />;
}

function RegisterForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");

  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-suggest the slug from the school name until the user edits it by hand.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(schoolName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolName, slugTouched]);

  // Debounced availability check.
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const data = await apiFetchPublic<{ available?: boolean; taken?: boolean }>(
          `/schools/check-slug?slug=${encodeURIComponent(slug)}`
        );
        const available = data?.available ?? (data?.taken === undefined ? true : !data.taken);
        setSlugStatus(available ? "available" : "taken");
      } catch {
        setSlugStatus("error");
      }
    }, 400);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (slugStatus === "taken") {
      setError("Mã trường (slug) đã được sử dụng, vui lòng chọn mã khác.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetchPublic("/schools/register", {
        method: "POST",
        body: {
          school_name: schoolName,
          slug,
          address: address || undefined,
          contact_phone: contactPhone || undefined,
          contact_email: contactEmail || undefined,
          admin_full_name: adminFullName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        },
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gửi đăng ký, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <BookMarked className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Đăng ký trường mới</h1>
          <p className="mt-1 text-sm text-slate-500">
            Điền thông tin trường và tài khoản quản trị đầu tiên. Yêu cầu sẽ được quản trị hệ thống phê duyệt trước
            khi bạn có thể đăng nhập.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin đăng ký</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <FormField>
                <Label htmlFor="school_name" required>
                  Tên trường
                </Label>
                <Input
                  id="school_name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="VD: Trường Tiểu học Nguyễn Siêu"
                  required
                />
              </FormField>

              <FormField>
                <Label htmlFor="slug" required>
                  Mã trường (slug) — dùng trong địa chỉ truy cập /{"{"}slug{"}"}
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="vd: truong_nguyensieu"
                  pattern="[a-z0-9_-]+"
                  required
                />
                <SlugHint status={slugStatus} />
              </FormField>

              <FormField>
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="contact_phone">Số điện thoại liên hệ</Label>
                  <Input id="contact_phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </FormField>
                <FormField>
                  <Label htmlFor="contact_email">Email liên hệ</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </FormField>
              </div>

              <hr className="my-5 border-slate-100" />
              <p className="mb-4 text-sm font-semibold text-slate-700">Tài khoản quản trị đầu tiên của trường</p>

              <FormField>
                <Label htmlFor="admin_full_name" required>
                  Họ tên
                </Label>
                <Input
                  id="admin_full_name"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="admin_email" required>
                    Email
                  </Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="admin_password" required>
                    Mật khẩu
                  </Label>
                  <Input
                    id="admin_password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </FormField>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Link href="/" className="text-sm font-medium text-slate-500 hover:underline">
                  Quay lại trang chủ
                </Link>
                <Button type="submit" loading={submitting} disabled={slugStatus === "taken"}>
                  Gửi đăng ký
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SlugHint({ status }: { status: SlugStatus }) {
  if (status === "idle") return null;
  if (status === "checking") {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra...
      </p>
    );
  }
  if (status === "available") {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Mã trường còn trống, có thể sử dụng.
      </p>
    );
  }
  if (status === "taken") {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
        <XCircle className="h-3 w-3" /> Mã trường đã được sử dụng, vui lòng chọn mã khác.
      </p>
    );
  }
  return <p className="mt-1.5 text-xs text-slate-400">Không thể kiểm tra mã trường lúc này.</p>;
}
