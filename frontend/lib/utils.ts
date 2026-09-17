export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export function isOverdue(dueAt?: string | null, returnedAt?: string | null): boolean {
  if (returnedAt) return false;
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Suggests a URL-safe school slug from a (Vietnamese) name: lowercase, no diacritics, `_`-separated. */
export function slugify(input: string): string {
  const noDiacritics = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return noDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function displayName(entity?: { name?: unknown; full_name?: unknown; title?: unknown; email?: unknown } | null): string {
  if (!entity) return "—";
  return (
    (entity.full_name as string) ||
    (entity.name as string) ||
    (entity.title as string) ||
    (entity.email as string) ||
    "—"
  );
}
