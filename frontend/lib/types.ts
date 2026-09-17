export type Role = "admin" | "librarian" | "teacher" | "student" | "parent";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị viên",
  librarian: "Thủ thư",
  teacher: "Giáo viên",
  student: "Học sinh",
  parent: "Phụ huynh",
};

export interface User {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  role: Role;
  phone?: string;
  max_borrow?: number;
  class_name?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Category {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Author {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Publisher {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface BookCopy {
  id: string;
  copy_code?: string;
  status?: string; // available | borrowed | reserved | lost | damaged | maintenance
  location?: string;
  price?: number;
  book_id?: string;
  [key: string]: unknown;
}

export interface Book {
  id: string;
  title?: string;
  name?: string;
  isbn?: string;
  description?: string;
  cover_url?: string;
  type?: string;
  category?: Category;
  category_id?: string;
  author?: Author;
  author_id?: string;
  authors?: Author[];
  publisher?: Publisher;
  publisher_id?: string;
  copies?: BookCopy[];
  available_count?: number;
  total_copies?: number;
  [key: string]: unknown;
}

export interface BorrowRecord {
  id: string;
  copy_id?: string;
  copy?: BookCopy;
  book?: Book;
  user_id?: string;
  user?: User;
  borrowed_at?: string;
  due_at?: string;
  returned_at?: string;
  status?: string; // borrowed | returned | overdue
  renew_count?: number;
  [key: string]: unknown;
}

export interface Reservation {
  id: string;
  book_id?: string;
  book?: Book;
  user_id?: string;
  user?: User;
  status?: string; // pending | ready | fulfilled | cancelled
  created_at?: string;
  [key: string]: unknown;
}

export interface Fine {
  id: string;
  user_id?: string;
  user?: User;
  borrow_id?: string;
  type?: string; // overdue | lost | damaged
  amount?: number;
  status?: string; // unpaid | paid | waived
  created_at?: string;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: string;
  title?: string;
  message?: string;
  content?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export interface OverviewReport {
  total_books?: number;
  total_copies?: number;
  borrowing_count?: number;
  overdue_count?: number;
  unpaid_fines_amount?: number;
  unpaid_fines_count?: number;
  [key: string]: unknown;
}

export interface ChildStatus {
  id: string;
  name?: string;
  full_name?: string;
  class_name?: string;
  borrowing_count?: number;
  overdue_count?: number;
  unpaid_fines_amount?: number;
  borrows?: BorrowRecord[];
  fines?: Fine[];
  [key: string]: unknown;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export type SchoolStatus = "pending" | "approved" | "rejected" | "suspended";

export const SCHOOL_STATUS_LABELS: Record<SchoolStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  suspended: "Tạm khoá",
};

export interface School {
  id: string;
  slug: string;
  name: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  status: SchoolStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  [key: string]: unknown;
}
