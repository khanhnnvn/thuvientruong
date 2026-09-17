"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useApi, useSlug, ApiError, unwrapList } from "@/lib/api";
import type { Author, Book, Category, Publisher } from "@/lib/types";
import { RoleGate } from "@/components/RoleGate";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, FormField, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function NewBookPage() {
  return (
    <RoleGate allow={["admin", "librarian"]}>
      <NewBookForm />
    </RoleGate>
  );
}

function NewBookForm() {
  const router = useRouter();
  const slug = useSlug();
  const apiFetch = useApi();
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);

  const [title, setTitle] = useState("");
  const [isbn, setIsbn] = useState("");
  const [type, setType] = useState("textbook");
  const [categoryId, setCategoryId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [initialCopies, setInitialCopies] = useState("1");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<unknown>("/categories").then((d) => setCategories(unwrapList<Category>(d))).catch(() => setCategories([]));
    apiFetch<unknown>("/authors").then((d) => setAuthors(unwrapList<Author>(d))).catch(() => setAuthors([]));
    apiFetch<unknown>("/publishers").then((d) => setPublishers(unwrapList<Publisher>(d))).catch(() => setPublishers([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const book = await apiFetch<Book>("/books", {
        method: "POST",
        body: {
          title,
          isbn: isbn || undefined,
          type,
          category_id: categoryId || undefined,
          author_id: authorId || undefined,
          publisher_id: publisherId || undefined,
          cover_url: coverUrl || undefined,
          description: description || undefined,
        },
      });

      const copies = Math.max(0, Number(initialCopies) || 0);
      if (book?.id && copies > 0) {
        await Promise.all(
          Array.from({ length: copies }).map(() => apiFetch(`/books/${book.id}/copies`, { method: "POST", body: {} }))
        );
      }

      toast.success("Đã thêm sách mới vào thư viện.");
      router.push(book?.id ? `/${slug}/books/${book.id}` : `/${slug}/books`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm sách. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${slug}/books`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Quay lại danh mục sách
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Thêm sách mới</CardTitle>
        </CardHeader>
        <CardBody>
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
                <Label htmlFor="type" required>
                  Loại ấn phẩm
                </Label>
                <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="textbook">Sách giáo khoa</option>
                  <option value="reference">Sách tham khảo</option>
                  <option value="fiction">Truyện / Văn học</option>
                  <option value="magazine">Tạp chí</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField>
                <Label htmlFor="category">Thể loại</Label>
                <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField>
                <Label htmlFor="author">Tác giả</Label>
                <Select id="author" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField>
                <Label htmlFor="publisher">Nhà xuất bản</Label>
                <Select id="publisher" value={publisherId} onChange={(e) => setPublisherId(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {publishers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
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

            <FormField>
              <Label htmlFor="initial_copies">Số bản sao khởi tạo</Label>
              <Input id="initial_copies" type="number" min={0} value={initialCopies} onChange={(e) => setInitialCopies(e.target.value)} />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Huỷ
              </Button>
              <Button type="submit" loading={submitting}>
                Lưu sách
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
