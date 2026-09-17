"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { apiFetch, unwrapList } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { formatDateTime, cn } from "@/lib/utils";

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    apiFetch<unknown>("/notifications")
      .then((data) => setItems(unwrapList<NotificationItem>(data)))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

  const unreadCount = items.filter((n) => !(n.read ?? n.is_read)).length;

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true, is_read: true } : n)));
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    } catch {
      // best-effort
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Thông báo</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!loaded && <p className="px-4 py-6 text-center text-sm text-slate-400">Đang tải...</p>}
            {loaded && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Không có thông báo nào</p>
            )}
            {items.map((n) => {
              const isRead = Boolean(n.read ?? n.is_read);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !isRead && markRead(n.id)}
                  className={cn(
                    "block w-full border-b border-slate-50 px-4 py-3 text-left text-sm last:border-0 hover:bg-slate-50",
                    !isRead && "bg-blue-50/60"
                  )}
                >
                  <p className={cn("text-slate-800", !isRead && "font-semibold")}>
                    {n.title || n.message || n.content || "Thông báo"}
                  </p>
                  {n.message && n.title && <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>}
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
