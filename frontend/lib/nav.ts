import type { Role } from "./types";
import { LayoutDashboard, BookOpen, ArrowLeftRight, BookmarkCheck, Receipt, Users } from "lucide-react";

export interface NavItem {
  /** Path suffix appended after `/{slug}`; "" means the school's dashboard root. */
  hrefSuffix: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    hrefSuffix: "",
    label: "Tổng quan",
    icon: LayoutDashboard,
    roles: ["admin", "librarian", "teacher", "student", "parent"],
  },
  {
    hrefSuffix: "/books",
    label: "Sách",
    icon: BookOpen,
    roles: ["admin", "librarian", "teacher", "student", "parent"],
  },
  {
    hrefSuffix: "/borrow",
    label: "Mượn / Trả",
    icon: ArrowLeftRight,
    roles: ["admin", "librarian"],
  },
  {
    hrefSuffix: "/reservations",
    label: "Đặt trước",
    icon: BookmarkCheck,
    roles: ["admin", "librarian", "teacher", "student"],
  },
  {
    hrefSuffix: "/fines",
    label: "Phạt",
    icon: Receipt,
    roles: ["admin", "librarian"],
  },
  {
    hrefSuffix: "/users",
    label: "Người dùng",
    icon: Users,
    roles: ["admin"],
  },
];

export interface ResolvedNavItem extends NavItem {
  href: string;
}

/** Builds nav links prefixed with `/{slug}` for the school the user is currently in. */
export function navForRole(role: Role | undefined | null, slug: string): ResolvedNavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    href: `/${slug}${item.hrefSuffix}`,
  }));
}
