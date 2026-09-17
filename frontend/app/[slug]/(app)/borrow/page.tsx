"use client";

import { useEffect, useState, FormEvent } from "react";
import { Plus, RotateCw, CheckCircle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useApi, ApiError, unwrapList } from "@/lib/api";
import type { BorrowRecord } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn, displayName, formatDate, isOverdue } from "@/lib/utils";

type Tab = "active" | "overdue" | "all";

export default function BorrowPage() {
  return (
    <RoleGate allow={["admin", "librarian"]}>
      <BorrowManager />
    </RoleGate>
  );
}

function BorrowManager() {
  const apiFetch = useApi();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("active");
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tab === "overdue") params.set("overdue", "true");
    else if (tab === "active") params.set("status", "borrowed");
    apiFetch<unknown>(`/borrow?${params.toString()}`)
      .then((data) => setRecords(unwrapList<BorrowRecord>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách mượn/trả."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tab]);

  async function handleReturn(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/borrow/${id}/return`, { method: "POST" });
      toast.success("Đã ghi nhận trả sách.");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể ghi nhận trả sách.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenew(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/borrow/${id}/renew`, { method: "POST" });
      toast.success("Đã gia hạn sách.");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể gia hạn, có thể sách đã bị đặt trước hoặc quá hạn.");
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: "Đang mượn" },
    { key: "overdue", label: "Quá hạn" },
    { key: "all", label: "Tất cả" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Quản lý mượn / trả</h1>
          <p className="mt-1 text-sm text-ink-soft">Theo dõi sách đang mượn, quá hạn và xử lý cho mượn mới.</p>
        </div>
        <Button onClick={() => setNewModalOpen(true)}>
          <Plus className="h-4 w-4" /> Cho mượn mới
        </Button>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border-2 border-ink/10 bg-paper-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.key
                ? t.key === "overdue"
                  ? "bg-board-brick-dark text-paper-white"
                  : "bg-board-blue-dark text-paper-white"
                : "text-ink-soft hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && records.length === 0 && (
            <EmptyState title="Không có bản ghi nào" description="Chưa có lượt mượn nào khớp với bộ lọc hiện tại." />
          )}
          {!loading && !error && records.length > 0 && (
            <>
              {/* Desktop / tablet: a real grid-lined table, never wrapping a date row mid-line. */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="divide-x divide-ink/15 border-b-2 border-ink/20 bg-paper text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2">Sách</th>
                      <th className="px-4 py-2">Người mượn</th>
                      <th className="px-4 py-2">Ngày mượn</th>
                      <th className="px-4 py-2">Hạn trả</th>
                      <th className="px-4 py-2">Trạng thái</th>
                      <th className="px-4 py-2 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const overdue = isOverdue(r.due_at, r.returned_at);
                      const returned = Boolean(r.returned_at) || r.status === "returned";
                      return (
                        <tr key={r.id} className={cn("divide-x divide-ink/10 border-b border-ink/12 last:border-0 hover:bg-ink/[0.02]", overdue && !returned && "bg-board-brick/[0.04]")}>
                          <td className="px-4 py-2.5 font-semibold text-ink">{r.book_title || r.book?.title || r.book?.name || r.copy_code || r.copy?.copy_code || "—"}</td>
                          <td className="px-4 py-2.5 text-ink-soft">{r.user_name || displayName(r.user)}</td>
                          <td className="tnum px-4 py-2.5 text-ink-soft">{formatDate(r.borrowed_at)}</td>
                          <td className="tnum px-4 py-2.5 text-ink-soft">{formatDate(r.due_at)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={returned ? "returned" : overdue ? "overdue" : "borrowed"} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-2">
                              {!returned && (
                                <>
                                  <Button size="sm" variant="outline" loading={busyId === r.id} onClick={() => handleRenew(r.id)}>
                                    <RotateCw className="h-3.5 w-3.5" /> Gia hạn
                                  </Button>
                                  <Button size="sm" loading={busyId === r.id} onClick={() => handleReturn(r.id)}>
                                    <CheckCircle className="h-3.5 w-3.5" /> Trả sách
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards, never a horizontally-scrolled table. */}
              <ul className="divide-y divide-ink/[0.07] sm:hidden">
                {records.map((r) => {
                  const overdue = isOverdue(r.due_at, r.returned_at);
                  const returned = Boolean(r.returned_at) || r.status === "returned";
                  return (
                    <li key={r.id} className={cn("space-y-2 py-3.5", overdue && !returned && "bg-board-brick/[0.04]")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{r.book_title || r.book?.title || r.book?.name || r.copy_code || r.copy?.copy_code || "—"}</p>
                          <p className="truncate text-sm text-ink-soft">{r.user_name || displayName(r.user)}</p>
                        </div>
                        <StatusBadge status={returned ? "returned" : overdue ? "overdue" : "borrowed"} />
                      </div>
                      <p className="tnum text-sm text-ink-soft">
                        Mượn {formatDate(r.borrowed_at)} · Hạn {formatDate(r.due_at)}
                      </p>
                      {!returned && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" loading={busyId === r.id} onClick={() => handleRenew(r.id)}>
                            <RotateCw className="h-3.5 w-3.5" /> Gia hạn
                          </Button>
                          <Button size="sm" className="flex-1" loading={busyId === r.id} onClick={() => handleReturn(r.id)}>
                            <CheckCircle className="h-3.5 w-3.5" /> Trả sách
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

      {newModalOpen && (
        <NewBorrowModal
          onClose={() => setNewModalOpen(false)}
          onSuccess={() => {
            setNewModalOpen(false);
            toast.success("Đã tạo lượt mượn mới.");
            load();
          }}
        />
      )}
    </div>
  );
}

function NewBorrowModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const apiFetch = useApi();
  const [copyId, setCopyId] = useState("");
  const [userId, setUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/borrow", {
        method: "POST",
        body: { copy_id: copyId, user_id: userId, ...(dueAt ? { due_at: new Date(dueAt).toISOString() } : {}) },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo lượt mượn.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Cho mượn sách mới">
      <form onSubmit={handleSubmit}>
        {error && <div className="mb-4 rounded-lg border-2 border-board-brick/25 bg-board-brick/[0.06] px-3 py-2 text-sm font-medium text-board-brick-dark">{error}</div>}
        <FormField>
          <Label htmlFor="copy_id" required>
            Mã bản sao (copy_id)
          </Label>
          <Input id="copy_id" value={copyId} onChange={(e) => setCopyId(e.target.value)} placeholder="Xem tại trang chi tiết sách" required />
        </FormField>
        <FormField>
          <Label htmlFor="user_id" required>
            Mã người mượn (user_id)
          </Label>
          <Input id="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} required />
        </FormField>
        <FormField>
          <Label htmlFor="due_at">Hạn trả (bỏ trống = mặc định 14 ngày)</Label>
          <Input id="due_at" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" loading={submitting}>
            Xác nhận
          </Button>
        </div>
      </form>
    </Modal>
  );
}
