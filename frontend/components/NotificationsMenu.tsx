"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useApi, unwrapList } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { formatDateTime, cn } from "@/lib/utils";

export function NotificationsMenu() {
  const apiFetch = useApi();
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
        className="relative rounded-full p-2 text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-board-brick-dark ring-2 ring-paper-light" />
        )}
      </button>
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-2 absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-ink/10 bg-paper-white shadow-pin-lg">
          <div className="border-b border-ink/10 px-4 py-3">
            <p className="font-display text-sm font-semibold text-ink">Thông báo</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!loaded && <p className="px-4 py-6 text-center text-sm text-ink-faint">Đang tải...</p>}
            {loaded && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">Không có thông báo nào</p>
            )}
            {items.map((n) => {
              const isRead = Boolean(n.read ?? n.is_read);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !isRead && markRead(n.id)}
                  className={cn(
                    "block w-full border-b border-ink/[0.06] px-4 py-3 text-left text-sm last:border-0 hover:bg-ink/[0.03]",
                    !isRead && "bg-board-blue/[0.06]"
                  )}
                >
                  <span className="flex items-start gap-2">
                    {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-board-blue-dark" />}
                    <span className="min-w-0 flex-1">
                      <p className={cn("text-ink", !isRead && "font-semibold")}>
                        {n.title || n.message || n.content || "Thông báo"}
                      </p>
                      {n.message && n.title && <p className="mt-0.5 text-xs text-ink-soft">{n.message}</p>}
                      <p className="mt-1 text-xs text-ink-faint">{formatDateTime(n.created_at)}</p>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
