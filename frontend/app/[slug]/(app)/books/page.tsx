"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi, useSlug, ApiError, unwrapList } from "@/lib/api";
import type { Author, Book, Category } from "@/lib/types";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { displayName } from "@/lib/utils";

const BOOK_TYPES = [
  { value: "", label: "Tất cả loại" },
  { value: "textbook", label: "Sách giáo khoa" },
  { value: "reference", label: "Sách tham khảo" },
  { value: "fiction", label: "Truyện / Văn học" },
  { value: "magazine", label: "Tạp chí" },
];

export default function BooksPage() {
  const { user } = useAuth();
  const slug = useSlug();
  const apiFetch = useApi();
  const canManage = user?.role === "admin" || user?.role === "librarian";

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [type, setType] = useState("");

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<unknown>("/categories").then((d) => setCategories(unwrapList<Category>(d))).catch(() => setCategories([]));
    apiFetch<unknown>("/authors").then((d) => setAuthors(unwrapList<Author>(d))).catch(() => setAuthors([]));
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("category_id", categoryId);
    if (authorId) params.set("author_id", authorId);
    if (type) params.set("type", type);
    apiFetch<unknown>(`/books?${params.toString()}`)
      .then((data) => setBooks(unwrapList<Book>(data)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách sách."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryId, authorId, type]);

  const hasFilters = useMemo(() => Boolean(q || categoryId || authorId || type), [q, categoryId, authorId, type]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Danh mục sách</h1>
          <p className="mt-1 text-sm text-slate-500">Tìm kiếm và tra cứu kho sách của thư viện.</p>
        </div>
        {canManage && (
          <Link href={`/${slug}/books/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Thêm sách mới
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo tên sách, ISBN..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả thể loại</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
          <option value="">Tất cả tác giả</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {BOOK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      {loading && <LoadingState label="Đang tải danh sách sách..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && books.length === 0 && (
        <EmptyState
          title="Không tìm thấy sách phù hợp"
          description={hasFilters ? "Thử điều chỉnh lại từ khoá hoặc bộ lọc." : "Kho sách hiện chưa có dữ liệu."}
        />
      )}

      {!loading && !error && books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const slug = useSlug();
  const available = (book.available_count ?? 0) > 0;
  const total = book.total_copies ?? book.copies?.length;

  return (
    <Link href={`/${slug}/books/${book.id}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow group-hover:shadow-md">
        <div className="flex aspect-[3/4] items-center justify-center bg-slate-100">
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover_url} alt={book.title || book.name || "Bìa sách"} className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="h-10 w-10 text-slate-300" />
          )}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900">{book.title || book.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{displayName(book.author) !== "—" ? displayName(book.author) : book.authors?.map((a) => a.name).join(", ") || "Chưa rõ tác giả"}</p>
          <div className="mt-2 flex items-center justify-between">
            <Badge tone={available ? "green" : "red"}>{available ? "Còn sách" : "Hết sách"}</Badge>
            {typeof total === "number" && <span className="text-xs text-slate-400">{total} bản</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
