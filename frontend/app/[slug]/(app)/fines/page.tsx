"use client";

import { useEffect, useState } from "react";
import { Wallet, ShieldOff } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useApi, ApiError, unwrapList } from "@/lib/api";
import type { Fine } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn, displayName, formatCurrency, formatDate } from "@/lib/utils";

const FINE_TYPE_LABEL: Record<string, string> = {
  overdue: "Trễ hạn",
  lost: "Mất sách",
  damaged: "Hư hỏng",
};

export default function FinesPage() {
  return (
    <RoleGate allow={["admin", "librarian"]}>
      <FinesManager />
    </RoleGate>
  );
}

function FinesManager() {
  const apiFetch = useApi();
  const toast = useToast();
  const [status, setStatus] = useState("unpaid");
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    apiFetch<unknown>(`/fines?${params.toString()}`)
      .then((data) => setFines(unwrapList<Fine>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách phạt."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  async function handlePay(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/fines/${id}/pay`, { method: "POST" });
      toast.success("Đã ghi nhận thu tiền phạt.");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể ghi nhận thu tiền.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleWaive(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/fines/${id}/waive`, { method: "POST" });
      toast.success("Đã miễn phạt.");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể miễn phạt.");
    } finally {
      setBusyId(null);
    }
  }

  const totalUnpaid = fines.filter((f) => f.status === "unpaid").reduce((sum, f) => sum + (f.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Quản lý phạt</h1>
          <p className="mt-1 text-sm text-ink-soft">Thu tiền phạt trễ hạn, mất hoặc hư hỏng sách.</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Tất cả</option>
          <option value="unpaid">Chưa thu</option>
          <option value="paid">Đã thu</option>
          <option value="waived">Đã miễn</option>
        </Select>
      </div>

      {status === "unpaid" && !loading && !error && (
        <div className="flex items-center gap-3 rounded-2xl bg-board-brick-dark px-5 py-4 text-paper-white shadow-pin">
          <Wallet className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">
            Tổng tiền phạt chưa thu: <span className="tnum font-display text-base font-extrabold">{formatCurrency(totalUnpaid)}</span>
          </p>
        </div>
      )}

      <Card>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && fines.length === 0 && (
            <EmptyState title="Không có khoản phạt nào" description="Danh sách sẽ hiển thị khi có phạt phát sinh." />
          )}
          {!loading && !error && fines.length > 0 && (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="divide-x divide-ink/15 border-b-2 border-ink/20 bg-paper text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2">Người vi phạm</th>
                      <th className="px-4 py-2">Loại</th>
                      <th className="px-4 py-2">Số tiền</th>
                      <th className="px-4 py-2">Ngày phát sinh</th>
                      <th className="px-4 py-2">Trạng thái</th>
                      <th className="px-4 py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map((f) => {
                      const isUnpaid = f.status === "unpaid" || !f.status;
                      return (
                        <tr key={f.id} className="divide-x divide-ink/10 border-b border-ink/12 last:border-0 hover:bg-ink/[0.02]">
                          <td className="px-4 py-2.5 font-semibold text-ink">{displayName(f.user)}</td>
                          <td className="px-4 py-2.5 text-ink-soft">{(f.type && FINE_TYPE_LABEL[f.type]) || f.type || "—"}</td>
                          <td className={cn("tnum px-4 py-2.5 font-display font-bold", isUnpaid ? "text-board-brick-dark" : "text-ink-soft")}>
                            {formatCurrency(f.amount)}
                          </td>
                          <td className="tnum px-4 py-2.5 text-ink-soft">{formatDate(f.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={f.status || "unpaid"} />
                          </td>
                          <td className="px-4 py-2.5">
                            {isUnpaid && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" loading={busyId === f.id} onClick={() => handlePay(f.id)}>
                                  <Wallet className="h-3.5 w-3.5" /> Thu tiền
                                </Button>
                                <Button size="sm" variant="outline" loading={busyId === f.id} onClick={() => handleWaive(f.id)}>
                                  <ShieldOff className="h-3.5 w-3.5" /> Miễn phạt
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-ink/[0.07] sm:hidden">
                {fines.map((f) => {
                  const isUnpaid = f.status === "unpaid" || !f.status;
                  return (
                    <li key={f.id} className="space-y-2 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{displayName(f.user)}</p>
                          <p className="text-sm text-ink-soft">{(f.type && FINE_TYPE_LABEL[f.type]) || f.type || "—"}</p>
                        </div>
                        <StatusBadge status={f.status || "unpaid"} />
                      </div>
                      <p className="flex items-center justify-between text-sm">
                        <span className="tnum text-ink-soft">{formatDate(f.created_at)}</span>
                        <span className={cn("tnum font-display font-bold", isUnpaid ? "text-board-brick-dark" : "text-ink-soft")}>
                          {formatCurrency(f.amount)}
                        </span>
                      </p>
                      {isUnpaid && (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" loading={busyId === f.id} onClick={() => handlePay(f.id)}>
                            <Wallet className="h-3.5 w-3.5" /> Thu tiền
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" loading={busyId === f.id} onClick={() => handleWaive(f.id)}>
                            <ShieldOff className="h-3.5 w-3.5" /> Miễn phạt
                          </Button>
                        </div>
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
