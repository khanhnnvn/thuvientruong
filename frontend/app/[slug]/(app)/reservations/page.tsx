"use client";

import { useEffect, useState } from "react";
import { XCircle, CheckCircle2, PackageCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi, ApiError, unwrapList } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { displayName, formatDate } from "@/lib/utils";

export default function ReservationsPage() {
  const { user } = useAuth();
  const apiFetch = useApi();
  const toast = useToast();
  const isStaff = user?.role === "admin" || user?.role === "librarian";

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (!isStaff) params.set("user_id", user.id);
    apiFetch<unknown>(`/reservations?${params.toString()}`)
      .then((data) => setReservations(unwrapList<Reservation>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách đặt trước."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [user, isStaff]);

  async function updateStatus(id: string, status: string, successMsg: string) {
    setBusyId(id);
    try {
      await apiFetch(`/reservations/${id}`, { method: "PATCH", body: { status } });
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật yêu cầu đặt trước.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Đặt trước sách</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isStaff ? "Quản lý các yêu cầu đặt trước từ học sinh, giáo viên." : "Danh sách sách bạn đã đặt trước."}
        </p>
      </div>

      <Card>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && reservations.length === 0 && (
            <EmptyState title="Chưa có yêu cầu đặt trước nào" description="Đặt trước sách khi sách hiện đã hết bản sẵn có." />
          )}
          {!loading && !error && reservations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Sách</th>
                    {isStaff && <th className="py-2 pr-4">Người đặt</th>}
                    <th className="py-2 pr-4">Ngày đặt</th>
                    <th className="py-2 pr-4">Trạng thái</th>
                    <th className="py-2 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => {
                    const isPending = r.status === "pending" || !r.status;
                    const isReady = r.status === "ready";
                    return (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-slate-800">{r.book?.title || r.book?.name || "—"}</td>
                        {isStaff && <td className="py-2.5 pr-4 text-slate-600">{displayName(r.user)}</td>}
                        <td className="py-2.5 pr-4 text-slate-600">{formatDate(r.created_at)}</td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={r.status || "pending"} />
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex justify-end gap-2">
                            {isStaff && isPending && (
                              <Button size="sm" loading={busyId === r.id} onClick={() => updateStatus(r.id, "ready", "Sách đã sẵn sàng để lấy.")}>
                                <PackageCheck className="h-3.5 w-3.5" /> Sẵn sàng
                              </Button>
                            )}
                            {isStaff && isReady && (
                              <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => updateStatus(r.id, "fulfilled", "Đã hoàn tất đặt trước.")}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Hoàn tất
                              </Button>
                            )}
                            {(isPending || isReady) && (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={busyId === r.id}
                                onClick={() => updateStatus(r.id, "cancelled", "Đã huỷ yêu cầu đặt trước.")}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Huỷ
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
