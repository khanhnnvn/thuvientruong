"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, BookCopy as BookCopyIcon, AlertTriangle, CheckCircle2, Wallet, ArrowRight, ArrowLeftRight, BookmarkCheck, Receipt } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi, useSlug, ApiError, unwrapList } from "@/lib/api";
import type { BorrowRecord, ChildStatus, OverviewReport } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, isOverdue, displayName } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return <LoadingState />;

  if (user.role === "admin" || user.role === "librarian") {
    return <OverviewDashboard />;
  }
  if (user.role === "parent") {
    return <ParentDashboard />;
  }
  return <SelfBorrowDashboard />;
}

const QUICK_LINKS = [
  { suffix: "/borrow", label: "Mượn / Trả sách", icon: ArrowLeftRight },
  { suffix: "/fines", label: "Quản lý phạt", icon: Receipt },
  { suffix: "/reservations", label: "Đặt trước", icon: BookmarkCheck },
  { suffix: "/books", label: "Danh mục sách", icon: BookOpen },
];

function OverviewDashboard() {
  const apiFetch = useApi();
  const slug = useSlug();
  const [data, setData] = useState<OverviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    apiFetch<OverviewReport>("/reports/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải báo cáo tổng quan."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <LoadingState label="Đang tải báo cáo tổng quan..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Tổng quan thư viện</h1>
        <p className="mt-1 text-sm text-ink-soft">Số liệu cập nhật theo thời gian thực từ hệ thống.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {data && data.overdue ? (
          <StatCard
            size="lg"
            tone="brick"
            icon={AlertTriangle}
            label="Quá hạn chưa trả"
            value={data.overdue}
            hint="Xử lý tại trang Mượn / Trả để tránh phát sinh thêm phạt."
            className="lg:col-span-7"
          />
        ) : (
          <StatCard
            size="lg"
            tone="green"
            icon={CheckCircle2}
            label="Quá hạn chưa trả"
            value={0}
            hint="Không có sách nào quá hạn — mọi lượt mượn đều trong hạn."
            className="lg:col-span-7"
          />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <StatCard label="Tổng số sách" value={data?.total_books ?? "—"} icon={BookOpen} tone="blue" />
          <StatCard label="Đang được mượn" value={data?.currently_borrowed ?? "—"} icon={BookCopyIcon} tone="orange" />
          <StatCard label="Phạt chưa thu" value={formatCurrency(Number(data?.unpaid_fines_total ?? 0))} icon={Wallet} tone="brick" />
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-ink-faint">Lối tắt</p>
        <div className="flex flex-wrap gap-2.5">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.suffix}
              href={`/${slug}${q.suffix}`}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-ink/12 bg-paper-white px-4 py-2.5 text-sm font-semibold text-ink shadow-pin-sm transition-all hover:border-board-blue/40 hover:shadow-pin"
            >
              <q.icon className="h-4 w-4 text-board-blue-dark" />
              {q.label}
              <ArrowRight className="h-3.5 w-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelfBorrowDashboard() {
  const { user } = useAuth();
  const apiFetch = useApi();
  const slug = useSlug();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    apiFetch<unknown>(`/borrow?user_id=${encodeURIComponent(user.id)}`)
      .then((data) => setRecords(unwrapList<BorrowRecord>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách sách đang mượn."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [user]);

  const active = records.filter((r) => !r.returned_at && r.status !== "returned");
  const overdueCount = active.filter((r) => isOverdue(r.due_at, r.returned_at)).length;
  const hasOverdue = overdueCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Xin chào, {displayName(user)}</h1>
        <p className="mt-1 text-sm text-ink-soft">Đây là tình trạng mượn sách của bạn.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <StatCard
          size="lg"
          tone={hasOverdue ? "brick" : "blue"}
          icon={hasOverdue ? AlertTriangle : BookOpen}
          label={hasOverdue ? "Sách quá hạn" : "Sách đang mượn"}
          value={hasOverdue ? overdueCount : active.length}
          hint={hasOverdue ? "Mang trả sớm để tránh phát sinh phạt." : "Ghé trang Sách để tìm và đặt trước thêm."}
          className="sm:col-span-7"
        />
        <StatCard
          label={hasOverdue ? "Sách đang mượn" : "Sách quá hạn"}
          value={hasOverdue ? active.length : overdueCount}
          icon={hasOverdue ? BookOpen : AlertTriangle}
          tone={hasOverdue ? "blue" : "brick"}
          className="sm:col-span-5"
        />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Sách đang mượn</CardTitle>
          <Link href={`/${slug}/books`} className="text-sm font-semibold text-board-blue-dark hover:underline">
            Tìm sách để đọc thêm
          </Link>
        </CardHeader>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && active.length === 0 && (
            <EmptyState title="Bạn chưa mượn sách nào" description="Ghé trang Sách để tìm và đặt trước sách yêu thích." />
          )}
          {!loading && !error && active.length > 0 && (
            <ul className="divide-y divide-ink/[0.07]">
              {active.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{r.book?.title || r.book?.name || "Sách"}</p>
                    <p className="tnum text-sm text-ink-soft">Hạn trả: {formatDate(r.due_at)}</p>
                  </div>
                  <StatusBadge status={isOverdue(r.due_at, r.returned_at) ? "overdue" : r.status || "borrowed"} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ParentDashboard() {
  const apiFetch = useApi();
  const [children, setChildren] = useState<ChildStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiFetch<unknown>("/me/children")
      .then((data) => setChildren(unwrapList<ChildStatus>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải thông tin học sinh."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Tình trạng thư viện của con</h1>
        <p className="mt-1 text-sm text-ink-soft">Theo dõi sách đang mượn và phạt (nếu có) của con bạn.</p>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && children.length === 0 && (
        <EmptyState title="Chưa có học sinh nào được liên kết" description="Liên hệ nhà trường để liên kết tài khoản phụ huynh với học sinh." />
      )}

      {!loading &&
        !error &&
        children.map((child) => {
          const overdue = child.overdue_count ?? 0;
          const unpaid = Number(child.unpaid_fines_total ?? 0);
          return (
            <Card key={child.id}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  {displayName(child)} {child.class_name ? `— Lớp ${child.class_name}` : ""}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-ink-soft">
                    Đang mượn <span className="tnum font-display font-bold text-ink">{child.active_borrows ?? child.borrows?.length ?? 0}</span>
                  </span>
                  <span className={overdue > 0 ? "font-semibold text-board-brick-dark" : "text-ink-soft"}>
                    Quá hạn <span className="tnum font-display font-bold">{overdue}</span>
                  </span>
                  <span className={unpaid > 0 ? "font-semibold text-board-brick-dark" : "text-ink-soft"}>
                    Phạt chưa thu <span className="tnum font-display font-bold">{formatCurrency(unpaid)}</span>
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                {child.borrows && child.borrows.length > 0 ? (
                  <ul className="divide-y divide-ink/[0.07]">
                    {child.borrows.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-4 py-2.5">
                        <p className="min-w-0 truncate text-sm font-semibold text-ink">{b.book?.title || b.book?.name || "Sách"}</p>
                        <div className="flex items-center gap-3">
                          <span className="tnum text-xs text-ink-soft">Hạn: {formatDate(b.due_at)}</span>
                          <StatusBadge status={isOverdue(b.due_at, b.returned_at) ? "overdue" : b.status || "borrowed"} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-faint">Hiện không mượn sách nào.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
    </div>
  );
}
