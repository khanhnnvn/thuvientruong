"use client";

import { useEffect, useState, FormEvent } from "react";
import { CheckCircle2, Eye, Lock, Search, Unlock, XCircle } from "lucide-react";
import { apiFetchSuperAdmin, ApiError, unwrapList } from "@/lib/api";
import type { School, SchoolStatus } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

export default function SuperAdminSchoolsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<SchoolStatus | "">("pending");
  const [q, setQ] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detailSchool, setDetailSchool] = useState<School | null>(null);
  const [rejectSchool, setRejectSchool] = useState<School | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    apiFetchSuperAdmin<unknown>(`/schools?${params.toString()}`)
      .then((data) => setSchools(unwrapList<School>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách trường."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  async function handleApprove(school: School) {
    setBusyId(school.id);
    try {
      await apiFetchSuperAdmin(`/schools/${school.id}/approve`, { method: "POST" });
      toast.success(`Đã duyệt trường "${school.name}".`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể duyệt trường.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSuspend(school: School) {
    setBusyId(school.id);
    try {
      await apiFetchSuperAdmin(`/schools/${school.id}/suspend`, { method: "POST" });
      toast.success(`Đã tạm khoá trường "${school.name}".`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tạm khoá trường.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(school: School) {
    setBusyId(school.id);
    try {
      await apiFetchSuperAdmin(`/schools/${school.id}/reactivate`, { method: "POST" });
      toast.success(`Đã mở lại trường "${school.name}".`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể mở lại trường.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-paper-white">Danh sách trường</h1>
        <p className="mt-1 text-sm text-paper-white/55">Duyệt đăng ký trường mới, tạm khoá hoặc mở lại trường đang hoạt động.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-paper-white/10 bg-system-ink-soft p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Tìm theo tên hoặc mã trường..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as SchoolStatus | "")}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
          <option value="suspended">Tạm khoá</option>
        </Select>
      </div>

      <Card>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && schools.length === 0 && (
            <EmptyState title="Không có trường nào" description="Chưa có trường nào khớp với bộ lọc hiện tại." />
          )}
          {!loading && !error && schools.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="divide-x divide-ink/15 border-b-2 border-ink/20 bg-paper text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2">Tên trường</th>
                    <th className="px-4 py-2">Mã trường</th>
                    <th className="px-4 py-2">Liên hệ</th>
                    <th className="px-4 py-2">Ngày đăng ký</th>
                    <th className="px-4 py-2">Trạng thái</th>
                    <th className="px-4 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => (
                    <tr key={s.id} className="divide-x divide-ink/10 border-b border-ink/12 last:border-0 hover:bg-ink/[0.02]">
                      <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{s.slug}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{s.contact_email || s.contact_phone || "—"}</td>
                      <td className="tnum px-4 py-2.5 text-ink-soft">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setDetailSchool(s)} title="Xem chi tiết">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {s.status === "pending" && (
                            <>
                              <Button size="sm" loading={busyId === s.id} onClick={() => handleApprove(s)}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                              </Button>
                              <Button size="sm" variant="outline" loading={busyId === s.id} onClick={() => setRejectSchool(s)}>
                                <XCircle className="h-3.5 w-3.5" /> Từ chối
                              </Button>
                            </>
                          )}
                          {s.status === "approved" && (
                            <Button size="sm" variant="outline" loading={busyId === s.id} onClick={() => handleSuspend(s)}>
                              <Lock className="h-3.5 w-3.5" /> Tạm khoá
                            </Button>
                          )}
                          {s.status === "suspended" && (
                            <Button size="sm" loading={busyId === s.id} onClick={() => handleReactivate(s)}>
                              <Unlock className="h-3.5 w-3.5" /> Mở lại
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {detailSchool && <SchoolDetailModal school={detailSchool} onClose={() => setDetailSchool(null)} />}

      {rejectSchool && (
        <RejectSchoolModal
          school={rejectSchool}
          onClose={() => setRejectSchool(null)}
          onSuccess={() => {
            setRejectSchool(null);
            toast.success(`Đã từ chối trường "${rejectSchool.name}".`);
            load();
          }}
        />
      )}
    </div>
  );
}

function SchoolDetailModal({ school, onClose }: { school: School; onClose: () => void }) {
  const [detail, setDetail] = useState<School>(school);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchSuperAdmin<School>(`/schools/${school.id}`)
      .then(setDetail)
      .catch(() => setDetail(school))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.id]);

  return (
    <Modal open onClose={onClose} title={`Chi tiết trường — ${detail.name}`}>
      {loading ? (
        <LoadingState label="Đang tải chi tiết..." />
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Info label="Tên trường" value={detail.name} />
          <Info label="Mã trường" value={detail.slug} />
          <Info label="Địa chỉ" value={detail.address} />
          <Info label="SĐT liên hệ" value={detail.contact_phone} />
          <Info label="Email liên hệ" value={detail.contact_email} />
          <Info label="Ngày đăng ký" value={formatDate(detail.created_at)} />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Trạng thái</dt>
            <dd className="mt-1">
              <StatusBadge status={detail.status} />
            </dd>
          </div>
          {detail.approved_at && <Info label="Ngày duyệt" value={formatDate(detail.approved_at)} />}
          {detail.status === "rejected" && detail.rejection_reason && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Lý do từ chối</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-ink">{detail.rejection_reason}</dd>
            </div>
          )}
        </dl>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

function RejectSchoolModal({ school, onClose, onSuccess }: { school: School; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchSuperAdmin(`/schools/${school.id}/reject`, { method: "POST", body: { reason } });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể từ chối trường.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Từ chối đăng ký — ${school.name}`}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-lg border-2 border-board-brick/25 bg-board-brick/[0.06] px-3 py-2 text-sm font-medium text-board-brick-dark">
            {error}
          </div>
        )}
        <label className="mb-1.5 block text-sm font-semibold text-ink" htmlFor="reason">
          Lý do từ chối <span className="ml-0.5 text-board-brick-dark">*</span>
        </label>
        <textarea
          id="reason"
          className="mb-4 w-full rounded-lg border-2 border-ink/15 bg-paper-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-board-blue focus:outline-none focus:ring-2 focus:ring-board-blue/20"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Thông tin liên hệ chưa hợp lệ, vui lòng đăng ký lại."
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Xác nhận từ chối
          </Button>
        </div>
      </form>
    </Modal>
  );
}
