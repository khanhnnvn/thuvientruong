"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  ArrowLeftRight,
  BookmarkCheck,
  Receipt,
  ShieldCheck,
  Building2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { slugify } from "@/lib/utils";

const FEATURES = [
  {
    icon: BookOpen,
    tone: "bg-board-blue-dark",
    title: "Danh mục sách",
    description: "Tra cứu đầu sách, tác giả, số bản còn sẵn theo thời gian thực.",
  },
  {
    icon: ArrowLeftRight,
    tone: "bg-board-orange-dark",
    title: "Mượn / Trả",
    description: "Gán bản sao, tính hạn trả, gia hạn chỉ trong một thao tác.",
  },
  {
    icon: BookmarkCheck,
    tone: "bg-board-green-dark",
    title: "Đặt trước",
    description: "Tự chuyển 'sẵn sàng' cho người đặt trước khi có sách trả về.",
  },
  {
    icon: Receipt,
    tone: "bg-board-brick-dark",
    title: "Phạt & quá hạn",
    description: "Theo dõi trễ hạn, thu hoặc miễn phạt ngay tại quầy thủ thư.",
  },
];

const NOTES: { tone: string; rotateDeg: string; icon: typeof Clock; text: string }[] = [
  {
    tone: "bg-board-orange-dark",
    rotateDeg: "-2deg",
    icon: Clock,
    text: "Sách “Dế Mèn phiêu lưu ký” sắp đến hạn trả — còn 2 ngày.",
  },
  {
    tone: "bg-board-blue-dark",
    rotateDeg: "1.5deg",
    icon: Building2,
    text: "Có 3 trường mới đăng ký, đang chờ quản trị hệ thống duyệt.",
  },
  {
    tone: "bg-board-green-dark",
    rotateDeg: "-1deg",
    icon: BookmarkCheck,
    text: "Đặt trước “Toán 6” đã sẵn sàng — thông báo đã gửi cho học sinh.",
  },
];

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
    <div className="min-h-screen bg-paper text-ink">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-ink) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-8 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-board-blue-dark text-paper-white">
            <BookMarked className="h-5 w-5" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-ink">Thư viện Trường học</span>
        </div>
      </div>

      {/* FIRST VIEWPORT: 7/12 pitch + CTA, 5/12 pinned live-notice cluster */}
      <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-7">
            <h1 className="max-w-xl text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Thư viện trường học, gọn trong một tấm bảng tin duy nhất.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">
              Thủ thư cho mượn và nhận trả trong vài giây, học sinh tự đặt trước khi hết sách, phụ huynh luôn biết
              con đang mượn gì. Mỗi trường có một không gian dữ liệu riêng, truy cập qua địa chỉ riêng của trường
              mình.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/dang-ky">
                <Button size="lg" className="w-full sm:w-auto">
                  Đăng ký cho trường của bạn <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <form onSubmit={handleGoToSchool} className="mt-8 max-w-sm rounded-2xl border-2 border-ink/12 bg-paper-white/70 p-4 shadow-pin-sm">
              <Label htmlFor="school-slug">Trường bạn đã có tài khoản?</Label>
              <div className="flex gap-2">
                <Input
                  id="school-slug"
                  placeholder="vd: truong_nguyensieu"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <Button type="submit" variant="outline" size="md" aria-label="Vào trang đăng nhập">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          <div className="relative lg:col-span-5">
            <div className="relative mx-auto flex max-w-sm flex-col gap-5 py-4 sm:max-w-md">
              {NOTES.map((note, i) => (
                <div
                  key={note.text}
                  className={`animate-pin-in relative ${i === 1 ? "ml-8 sm:ml-14" : "ml-0"} rounded-2xl ${note.tone} p-5 text-paper-white shadow-pin-lg`}
                  style={{ "--pin-rotate": note.rotateDeg, animationDelay: `${i * 140 + 120}ms` } as React.CSSProperties}
                >
                  <span className="absolute -top-2 left-6 h-4 w-4 rounded-full bg-paper-white shadow-pin-sm" />
                  <note.icon className="h-5 w-5 text-paper-white/85" />
                  <p className="mt-3 text-sm font-semibold leading-snug">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timetable-style feature strip — each block pinned like a card on the board, not a generic feature grid */}
      <section className="mx-auto max-w-7xl px-6 pb-20 sm:px-8">
        <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`animate-pin-in relative flex flex-col justify-between rounded-2xl ${f.tone} p-6 text-paper-white shadow-pin-lg`}
              style={{ "--pin-rotate": i % 2 === 0 ? "-0.8deg" : "0.9deg", animationDelay: `${i * 90 + 260}ms` } as React.CSSProperties}
            >
              <span className="absolute -top-2 left-6 h-4 w-4 rounded-full bg-paper-white shadow-pin-sm" />
              <f.icon className="h-6 w-6 text-paper-white/85" />
              <div className="mt-6">
                <p className="font-display text-lg font-bold tracking-tight">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-white/85">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border-2 border-ink/12 bg-paper-white p-8 shadow-pin sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl font-bold tracking-tight text-ink">Trường bạn chưa có tài khoản?</p>
            <p className="mt-1.5 max-w-md text-sm text-ink-soft">
              Gửi đăng ký, quản trị hệ thống xem xét rồi trường của bạn có thể vào dùng ngay — không cần triển khai
              riêng.
            </p>
          </div>
          <Link href="/dang-ky" className="shrink-0">
            <Button variant="secondary" size="lg">
              Đăng ký cho trường của bạn <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink/10 py-6 text-center">
        <Link
          href="/super-admin/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-ink-soft"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Đăng nhập quản trị hệ thống
        </Link>
      </footer>
    </div>
  );
}
