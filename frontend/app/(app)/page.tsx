"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, BookCopy as BookCopyIcon, AlertTriangle, Wallet, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, unwrapList } from "@/lib/api";
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

function OverviewDashboard() {
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
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan thư viện</h1>
        <p className="mt-1 text-sm text-slate-500">Số liệu cập nhật theo thời gian thực từ hệ thống.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số sách" value={data?.total_books ?? "—"} icon={BookOpen} tone="blue" />
        <StatCard label="Đang được mượn" value={data?.borrowing_count ?? "—"} icon={BookCopyIcon} tone="green" />
        <StatCard label="Quá hạn chưa trả" value={data?.overdue_count ?? "—"} icon={AlertTriangle} tone="red" />
        <StatCard
          label="Phạt chưa thu"
          value={formatCurrency(data?.unpaid_fines_amount ?? 0)}
          icon={Wallet}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickLinkCard href="/borrow" title="Mượn / Trả sách" description="Xử lý cho mượn, trả sách, gia hạn" />
        <QuickLinkCard href="/fines" title="Quản lý phạt" description="Thu tiền phạt hoặc miễn phạt cho học sinh" />
        <QuickLinkCard href="/reservations" title="Đặt trước" description="Xử lý các yêu cầu đặt trước sách" />
        <QuickLinkCard href="/books" title="Danh mục sách" description="Tìm kiếm và quản lý kho sách" />
      </div>
    </div>
  );
}

function QuickLinkCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="flex items-center justify-between p-5 transition-shadow hover:shadow-md">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400" />
      </Card>
    </Link>
  );
}

function SelfBorrowDashboard() {
  const { user } = useAuth();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Xin chào, {displayName(user)} 👋</h1>
        <p className="mt-1 text-sm text-slate-500">Đây là tình trạng mượn sách của bạn.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Sách đang mượn" value={active.length} icon={BookOpen} tone="blue" />
        <StatCard label="Sách quá hạn" value={overdueCount} icon={AlertTriangle} tone="red" />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Sách đang mượn</CardTitle>
          <Link href="/books" className="text-sm font-medium text-blue-600 hover:underline">
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
            <ul className="divide-y divide-slate-100">
              {active.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.book?.title || r.book?.name || "Sách"}</p>
                    <p className="text-sm text-slate-500">Hạn trả: {formatDate(r.due_at)}</p>
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
        <h1 className="text-2xl font-bold text-slate-900">Tình trạng thư viện của con</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi sách đang mượn và phạt (nếu có) của con bạn.</p>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && children.length === 0 && (
        <EmptyState title="Chưa có học sinh nào được liên kết" description="Liên hệ nhà trường để liên kết tài khoản phụ huynh với học sinh." />
      )}

      {!loading &&
        !error &&
        children.map((child) => (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle>
                {displayName(child)} {child.class_name ? `— Lớp ${child.class_name}` : ""}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Đang mượn" value={child.borrowing_count ?? child.borrows?.length ?? 0} icon={BookOpen} tone="blue" />
                <StatCard label="Quá hạn" value={child.overdue_count ?? 0} icon={AlertTriangle} tone="red" />
                <StatCard label="Phạt chưa thu" value={formatCurrency(child.unpaid_fines_amount ?? 0)} icon={Wallet} tone="amber" />
              </div>
              {child.borrows && child.borrows.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {child.borrows.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-4 py-2.5">
                      <p className="min-w-0 truncate text-sm font-medium text-slate-800">{b.book?.title || b.book?.name || "Sách"}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Hạn: {formatDate(b.due_at)}</span>
                        <StatusBadge status={isOverdue(b.due_at, b.returned_at) ? "overdue" : b.status || "borrowed"} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
    </div>
  );
}
