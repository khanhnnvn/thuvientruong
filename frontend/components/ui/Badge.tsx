import { cn } from "@/lib/utils";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "purple";

const TONE_CLASSES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({ children, tone = "slate", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  available: "green",
  borrowed: "blue",
  reserved: "amber",
  lost: "red",
  damaged: "red",
  maintenance: "slate",
  overdue: "red",
  returned: "slate",
  pending: "amber",
  ready: "blue",
  fulfilled: "green",
  cancelled: "slate",
  unpaid: "red",
  paid: "green",
  waived: "slate",
  admin: "purple",
  librarian: "blue",
  teacher: "green",
  student: "amber",
  parent: "slate",
  approved: "green",
  rejected: "red",
  suspended: "amber",
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
  return <Badge tone={STATUS_TONE[key] ?? "slate"}>{STATUS_LABEL[key] ?? status}</Badge>;
}
