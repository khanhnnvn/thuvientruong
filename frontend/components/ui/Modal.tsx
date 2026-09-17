"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const sizeClass = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div className={`animate-in fade-in slide-in-from-bottom-2 w-full ${sizeClass} rounded-2xl border border-ink/10 bg-paper-white shadow-pin-lg`}>
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
