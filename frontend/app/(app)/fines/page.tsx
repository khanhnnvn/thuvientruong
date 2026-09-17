"use client";

import { useEffect, useState } from "react";
import { Wallet, ShieldOff } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { apiFetch, ApiError, unwrapList } from "@/lib/api";
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
          <h1 className="text-2xl font-bold text-slate-900">Quản lý phạt</h1>
          <p className="mt-1 text-sm text-slate-500">Thu tiền phạt trễ hạn, mất hoặc hư hỏng sách.</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Tất cả</option>
          <option value="unpaid">Chưa thu</option>
          <option value="paid">Đã thu</option>
          <option value="waived">Đã miễn</option>
        </Select>
      </div>

      {status === "unpaid" && !loading && !error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Wallet className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">Tổng tiền phạt chưa thu: {formatCurrency(totalUnpaid)}</p>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Người vi phạm</th>
                    <th className="py-2 pr-4">Loại</th>
                    <th className="py-2 pr-4">Số tiền</th>
                    <th className="py-2 pr-4">Ngày phát sinh</th>
                    <th className="py-2 pr-4">Trạng thái</th>
                    <th className="py-2 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((f) => {
                    const isUnpaid = f.status === "unpaid" || !f.status;
                    return (
                      <tr key={f.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-slate-800">{displayName(f.user)}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{(f.type && FINE_TYPE_LABEL[f.type]) || f.type || "—"}</td>
                        <td className={cn("py-2.5 pr-4 font-semibold", isUnpaid ? "text-red-600" : "text-slate-600")}>
                          {formatCurrency(f.amount)}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">{formatDate(f.created_at)}</td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={f.status || "unpaid"} />
                        </td>
                        <td className="py-2.5 pr-4">
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
          )}
        </CardBody>
      </Card>
    </div>
  );
}
