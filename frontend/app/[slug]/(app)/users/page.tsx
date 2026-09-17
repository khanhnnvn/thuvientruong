"use client";

import { useEffect, useState, FormEvent } from "react";
import { Plus, KeyRound, Link2, Pencil, Search } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useApi, ApiError, unwrapList } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { displayName } from "@/lib/utils";

const ROLE_OPTIONS: Role[] = ["admin", "librarian", "teacher", "student", "parent"];

export default function UsersPage() {
  return (
    <RoleGate allow={["admin"]}>
      <UsersManager />
    </RoleGate>
  );
}

function UsersManager() {
  const apiFetch = useApi();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [linkUser, setLinkUser] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    apiFetch<unknown>(`/users?${params.toString()}`)
      .then((data) => setUsers(unwrapList<User>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách người dùng."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role]);

  async function handleResetPassword(user: User) {
    if (!confirm(`Đặt lại mật khẩu cho ${displayName(user)}?`)) return;
    setBusyId(user.id);
    try {
      await apiFetch(`/users/${user.id}/reset-password`, { method: "POST" });
      toast.success("Đã đặt lại mật khẩu, hướng dẫn đã được gửi/hiển thị cho quản trị viên.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">Tạo tài khoản, gán vai trò, liên kết phụ huynh - học sinh.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Tạo tài khoản
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm theo tên hoặc email..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardBody>
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && users.length === 0 && (
            <EmptyState title="Không tìm thấy người dùng" description="Thử điều chỉnh từ khoá hoặc tạo tài khoản mới." />
          )}
          {!loading && !error && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Họ tên</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Vai trò</th>
                    <th className="py-2 pr-4">Lớp</th>
                    <th className="py-2 pr-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{displayName(u)}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={u.role} />
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{u.class_name || "—"}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setEditUser(u)} title="Sửa">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.role === "student" && (
                            <Button size="sm" variant="ghost" onClick={() => setLinkUser(u)} title="Liên kết phụ huynh">
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" loading={busyId === u.id} onClick={() => handleResetPassword(u)} title="Đặt lại mật khẩu">
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
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

      {createOpen && (
        <UserFormModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            toast.success("Đã tạo tài khoản mới.");
            load();
          }}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => {
            setEditUser(null);
            toast.success("Đã cập nhật tài khoản.");
            load();
          }}
        />
      )}

      {linkUser && (
        <LinkParentModal
          student={linkUser}
          onClose={() => setLinkUser(null)}
          onSuccess={() => {
            setLinkUser(null);
            toast.success("Đã liên kết phụ huynh - học sinh.");
            load();
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({ user, onClose, onSuccess }: { user?: User; onClose: () => void; onSuccess: () => void }) {
  const apiFetch = useApi();
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.full_name || user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState<Role>(user?.role || "student");
  const [className, setClassName] = useState(user?.class_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name, email, role, class_name: className || undefined, phone: phone || undefined };
      if (!isEdit) body.password = password;
      if (isEdit && user) {
        await apiFetch(`/users/${user.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/users", { method: "POST", body });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu thông tin người dùng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Sửa tài khoản" : "Tạo tài khoản mới"}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormField>
          <Label htmlFor="name" required>
            Họ tên
          </Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isEdit} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField>
            <Label htmlFor="role" required>
              Vai trò
            </Label>
            <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField>
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
        </div>
        {(role === "student" || role === "teacher") && (
          <FormField>
            <Label htmlFor="class_name">Lớp / Bộ môn</Label>
            <Input id="class_name" value={className} onChange={(e) => setClassName(e.target.value)} />
          </FormField>
        )}
        {!isEdit && (
          <FormField>
            <Label htmlFor="password" required>
              Mật khẩu ban đầu
            </Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </FormField>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Lưu thay đổi" : "Tạo tài khoản"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LinkParentModal({ student, onClose, onSuccess }: { student: User; onClose: () => void; onSuccess: () => void }) {
  const apiFetch = useApi();
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${student.id}/link-parent`, { method: "POST", body: { parent_id: parentId } });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể liên kết phụ huynh.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Liên kết phụ huynh cho ${displayName(student)}`}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormField>
          <Label htmlFor="parent_id" required>
            Mã tài khoản phụ huynh (user_id)
          </Label>
          <Input id="parent_id" value={parentId} onChange={(e) => setParentId(e.target.value)} required placeholder="Tra cứu tại danh sách người dùng, lọc theo Phụ huynh" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" loading={submitting}>
            Liên kết
          </Button>
        </div>
      </form>
    </Modal>
  );
}
