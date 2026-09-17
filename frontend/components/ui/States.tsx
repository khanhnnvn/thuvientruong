import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-board-blue-dark ${className}`} />;
}

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-soft">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-board-brick/25 bg-board-brick/[0.06] py-14 text-center">
      <AlertTriangle className="h-8 w-8 text-board-brick-dark" />
      <p className="max-w-md text-sm font-semibold text-board-brick-dark">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border-2 border-board-brick/30 bg-paper-white px-4 py-1.5 text-sm font-semibold text-board-brick-dark hover:bg-board-brick/10"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-paper-light py-14 text-center">
      <Inbox className="h-8 w-8 text-ink-faint" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}
