import { cn } from "@/lib/utils";

type Tone = "blue" | "orange" | "brick" | "green" | "neutral";

// Solid, decisive fills — a status reads like a marker-colored tag pinned to
// the board, never a pastel SaaS chip. `neutral` is an outlined ink label,
// reserved for things that aren't a lifecycle state (roles, "no status").
const TONE_CLASSES: Record<Tone, string> = {
  blue: "bg-board-blue-dark text-paper-white",
  orange: "bg-board-orange-dark text-paper-white",
  brick: "bg-board-brick-dark text-paper-white",
  green: "bg-board-green-dark text-paper-white",
  neutral: "border border-ink/20 bg-transparent text-ink-soft",
};

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Fixed, system-wide meaning: xanh = sách/danh mục, cam = mượn/trả (+ pending),
// gạch = quá hạn/phạt/cảnh báo (+ rejected/suspended), lá = đặt trước/hoàn
// thành/đã duyệt. Roles are not a lifecycle state, so they get the neutral
// outline label instead of borrowing a status color.
const STATUS_TONE: Record<string, Tone> = {
  available: "blue",
  borrowed: "orange",
  reserved: "green",
  lost: "brick",
  damaged: "brick",
  maintenance: "neutral",
  overdue: "brick",
  returned: "green",
  pending: "orange",
  ready: "green",
  fulfilled: "green",
  cancelled: "neutral",
  unpaid: "brick",
  paid: "green",
  waived: "neutral",
  admin: "neutral",
  librarian: "neutral",
  teacher: "neutral",
  student: "neutral",
  parent: "neutral",
  approved: "green",
  rejected: "brick",
  suspended: "brick",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Còn sẵn",
  borrowed: "Đang mượn",
  reserved: "Đã đặt trước",
  lost: "Mất",
  damaged: "Hư hỏng",
  maintenance: "Bảo trì",
  overdue: "Quá hạn",
  returned: "Đã trả",
  pending: "Chờ xử lý",
  ready: "Sẵn sàng lấy",
  fulfilled: "Đã hoàn tất",
  cancelled: "Đã huỷ",
  unpaid: "Chưa thu",
  paid: "Đã thu",
  waived: "Đã miễn",
  admin: "Quản trị viên",
  librarian: "Thủ thư",
  teacher: "Giáo viên",
  student: "Học sinh",
  parent: "Phụ huynh",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  suspended: "Tạm khoá",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge>—</Badge>;
  const key = status.toLowerCase();
  return <Badge tone={STATUS_TONE[key] ?? "neutral"}>{STATUS_LABEL[key] ?? status}</Badge>;
}
