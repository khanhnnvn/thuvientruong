"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Plus, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, unwrapList } from "@/lib/api";
import type { Book, BookCopy } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Label, FormField, Select, Textarea } from "@/components/ui/Input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { displayName } from "@/lib/utils";

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { user } = useAuth();
  const toast = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrowModal, setBorrowModal] = useState<BookCopy | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "librarian";
  const canBorrowFor = user?.role === "librarian";
  const canReserve = user?.role === "student" || user?.role === "teacher";

  function load() {
    setLoading(true);
    setError(null);
    apiFetch<Book>(`/books/${id}`)
      .then(setBook)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải thông tin sách."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleReserve() {
    try {
      await apiFetch("/reservations", { method: "POST", body: { book_id: id } });
      toast.success("Đã gửi yêu cầu đặt trước sách.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể đặt trước sách.");
    }
  }

  if (loading) return <LoadingState label="Đang tải thông tin sách..." />;
  if (error || !book) return <ErrorState message={error || "Không tìm thấy sách."} onRetry={load} />;

  const copies = book.copies ?? [];
  const hasAvailable = copies.some((c) => c.status === "available") || (book.available_count ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Link href="/books" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Quay lại danh mục sách
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title || "Bìa sách"} className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="h-16 w-16 text-slate-300" />
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{book.title || book.name}</CardTitle>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditMode((v) => !v)}>
                  <Pencil className="h-4 w-4" /> {editMode ? "Đóng chỉnh sửa" : "Sửa thông tin"}
                </Button>
              )}
            </CardHeader>
            <CardBody>
              {!editMode ? (
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <Info label="Tác giả" value={displayName(book.author) !== "—" ? displayName(book.author) : book.authors?.map((a) => a.name).join(", ")} />
                  <Info label="Nhà xuất bản" value={displayName(book.publisher)} />
                  <Info label="Thể loại" value={displayName(book.category)} />
                  <Info label="ISBN" value={book.isbn} />
                  <Info label="Loại ấn phẩm" value={book.type} />
                  <Info label="Số bản còn sẵn" value={String(book.available_count ?? "—")} />
                  <div className="sm:col-span-2">
                    <dt className="mb-1 text-xs font-medium uppercase text-slate-400">Mô tả</dt>
                    <dd className="whitespace-pre-line text-sm text-slate-700">{book.description || "Chưa có mô tả."}</dd>
                  </div>
                </dl>
              ) : (
                <EditBookForm book={book} onSaved={(b) => { setBook(b); setEditMode(false); toast.success("Đã cập nhật thông tin sách."); }} />
              )}
            </CardBody>
          </Card>

          {!editMode && (
            <div className="flex flex-wrap gap-2">
              {canReserve && !hasAvailable && (
                <Button onClick={handleReserve}>Đặt trước sách này</Button>
              )}
              {canReserve && hasAvailable && (
                <span className="text-sm text-emerald-600">Sách hiện còn bản sẵn có, đến thư viện để mượn.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Danh sách bản sao ({copies.length})</CardTitle>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setCopyModalOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm bản sao
            </Button>
          )}
        </CardHeader>
        <CardBody>
          {copies.length === 0 ? (
            <EmptyState title="Chưa có bản sao nào" description="Thêm bản sao để bắt đầu cho mượn." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Mã bản sao</th>
                    <th className="py-2 pr-4">Vị trí</th>
                    <th className="py-2 pr-4">Trạng thái</th>
                    {canBorrowFor && <th className="py-2 pr-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {copies.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{c.copy_code || c.id}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{c.location || "—"}</td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={c.status} />
                      </td>
                      {canBorrowFor && (
                        <td className="py-2.5 pr-4 text-right">
                          {c.status === "available" ? (
                            <Button size="sm" onClick={() => setBorrowModal(c)}>
                              Cho mượn
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {borrowModal && (
        <BorrowModal
          copy={borrowModal}
          onClose={() => setBorrowModal(null)}
          onSuccess={() => {
            setBorrowModal(null);
            toast.success("Đã cho mượn sách thành công.");
            load();
          }}
        />
      )}

      {copyModalOpen && (
        <AddCopyModal
          bookId={id}
          onClose={() => setCopyModalOpen(false)}
          onSuccess={() => {
            setCopyModalOpen(false);
            toast.success("Đã thêm bản sao mới.");
            load();
          }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function BorrowModal({ copy, onClose, onSuccess }: { copy: BookCopy; onClose: () => void; onSuccess: () => void }) {
  const [userId, setUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/borrow", {
        method: "POST",
        body: { copy_id: copy.id, user_id: userId, ...(dueAt ? { due_at: new Date(dueAt).toISOString() } : {}) },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cho mượn sách.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Cho mượn — bản sao ${copy.copy_code || copy.id}`}>
      <form onSubmit={handleSubmit}>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormField>
          <Label htmlFor="user_id" required>
            Mã hoặc email người mượn
          </Label>
          <Input id="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="ID người dùng" required />
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
            Xác nhận cho mượn
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddCopyModal({ bookId, onClose, onSuccess }: { bookId: string; onClose: () => void; onSuccess: () => void }) {
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/books/${bookId}/copies`, {
        method: "POST",
        body: { location: location || undefined, price: price ? Number(price) : undefined },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm bản sao.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Thêm bản sao mới">
      <form onSubmit={handleSubmit}>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormField>
          <Label htmlFor="location">Vị trí lưu trữ (kệ, phòng...)</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Kệ A1" />
        </FormField>
        <FormField>
          <Label htmlFor="price">Giá bìa (VNĐ)</Label>
          <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="VD: 50000" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="secondary" loading={submitting}>
            Thêm bản sao
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditBookForm({ book, onSaved }: { book: Book; onSaved: (b: Book) => void }) {
  const [title, setTitle] = useState(book.title || book.name || "");
  const [isbn, setIsbn] = useState(book.isbn || "");
  const [type, setType] = useState(book.type || "");
  const [description, setDescription] = useState(book.description || "");
  const [coverUrl, setCoverUrl] = useState(book.cover_url || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiFetch<Book>(`/books/${book.id}`, {
        method: "PATCH",
        body: { title, isbn, type, description, cover_url: coverUrl },
      });
      onSaved({ ...book, ...updated });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật sách.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <FormField>
        <Label htmlFor="title" required>
          Tên sách
        </Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField>
          <Label htmlFor="isbn">ISBN</Label>
          <Input id="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        </FormField>
        <FormField>
          <Label htmlFor="type">Loại ấn phẩm</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Chọn loại</option>
            <option value="textbook">Sách giáo khoa</option>
            <option value="reference">Sách tham khảo</option>
            <option value="fiction">Truyện / Văn học</option>
            <option value="magazine">Tạp chí</option>
          </Select>
        </FormField>
      </div>
      <FormField>
        <Label htmlFor="cover_url">Đường dẫn ảnh bìa</Label>
        <Input id="cover_url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
      </FormField>
      <FormField>
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
