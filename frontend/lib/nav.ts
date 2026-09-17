import type { Role } from "./types";
import { LayoutDashboard, BookOpen, ArrowLeftRight, BookmarkCheck, Receipt, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Tổng quan",
    icon: LayoutDashboard,
    roles: ["admin", "librarian", "teacher", "student", "parent"],
  },
  {
    href: "/books",
    label: "Sách",
    icon: BookOpen,
    roles: ["admin", "librarian", "teacher", "student", "parent"],
  },
  {
    href: "/borrow",
    label: "Mượn / Trả",
    icon: ArrowLeftRight,
    roles: ["admin", "librarian"],
  },
  {
    href: "/reservations",
    label: "Đặt trước",
    icon: BookmarkCheck,
    roles: ["admin", "librarian", "teacher", "student"],
  },
  {
    href: "/fines",
    label: "Phạt",
    icon: Receipt,
    roles: ["admin", "librarian"],
  },
  {
    href: "/users",
    label: "Người dùng",
    icon: Users,
    roles: ["admin"],
  },
];

export function navForRole(role?: Role | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
