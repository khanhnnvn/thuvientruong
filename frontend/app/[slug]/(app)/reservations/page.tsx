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
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Đặt trước sách</h1>
        <p className="mt-1 text-sm text-ink-soft">
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
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="divide-x divide-ink/15 border-b-2 border-ink/20 bg-paper text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2">Sách</th>
                      {isStaff && <th className="px-4 py-2">Người đặt</th>}
                      <th className="px-4 py-2">Ngày đặt</th>
                      <th className="px-4 py-2">Trạng thái</th>
                      <th className="px-4 py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => {
                      const isPending = r.status === "pending" || !r.status;
                      const isReady = r.status === "ready";
                      return (
                        <tr key={r.id} className="divide-x divide-ink/10 border-b border-ink/12 last:border-0 hover:bg-ink/[0.02]">
                          <td className="px-4 py-2.5 font-semibold text-ink">{r.book?.title || r.book?.name || "—"}</td>
                          {isStaff && <td className="px-4 py-2.5 text-ink-soft">{displayName(r.user)}</td>}
                          <td className="tnum px-4 py-2.5 text-ink-soft">{formatDate(r.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={r.status || "pending"} />
                          </td>
                          <td className="px-4 py-2.5">
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

              <ul className="divide-y divide-ink/[0.07] sm:hidden">
                {reservations.map((r) => {
                  const isPending = r.status === "pending" || !r.status;
                  const isReady = r.status === "ready";
                  return (
                    <li key={r.id} className="space-y-2 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{r.book?.title || r.book?.name || "—"}</p>
                          {isStaff && <p className="truncate text-sm text-ink-soft">{displayName(r.user)}</p>}
                        </div>
                        <StatusBadge status={r.status || "pending"} />
                      </div>
                      <p className="tnum text-sm text-ink-soft">Ngày đặt: {formatDate(r.created_at)}</p>
                      {(isStaff && (isPending || isReady)) && (
                        <div className="flex flex-wrap gap-2">
                          {isPending && (
                            <Button size="sm" className="flex-1" loading={busyId === r.id} onClick={() => updateStatus(r.id, "ready", "Sách đã sẵn sàng để lấy.")}>
                              <PackageCheck className="h-3.5 w-3.5" /> Sẵn sàng
                            </Button>
                          )}
                          {isReady && (
                            <Button size="sm" variant="secondary" className="flex-1" loading={busyId === r.id} onClick={() => updateStatus(r.id, "fulfilled", "Đã hoàn tất đặt trước.")}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Hoàn tất
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="flex-1" loading={busyId === r.id} onClick={() => updateStatus(r.id, "cancelled", "Đã huỷ yêu cầu đặt trước.")}>
                            <XCircle className="h-3.5 w-3.5" /> Huỷ
                          </Button>
                        </div>
                      )}
                      {!isStaff && (isPending || isReady) && (
                        <Button size="sm" variant="outline" className="w-full" loading={busyId === r.id} onClick={() => updateStatus(r.id, "cancelled", "Đã huỷ yêu cầu đặt trước.")}>
                          <XCircle className="h-3.5 w-3.5" /> Huỷ
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
