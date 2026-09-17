"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Solid board-marker fills read as pinned, decisive controls rather than a
// generic SaaS blue button — real offset shadow, no zero-blur "neobrutalist"
// block shadow.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-board-blue-dark text-paper-white shadow-pin-sm hover:bg-[#234867] hover:shadow-pin active:translate-y-px active:shadow-pin-sm focus-visible:outline-board-blue",
  secondary:
    "bg-board-green-dark text-paper-white shadow-pin-sm hover:bg-[#3c5233] hover:shadow-pin active:translate-y-px active:shadow-pin-sm focus-visible:outline-board-green",
  danger:
    "bg-board-brick-dark text-paper-white shadow-pin-sm hover:bg-[#7a301a] hover:shadow-pin active:translate-y-px active:shadow-pin-sm focus-visible:outline-board-brick",
  outline:
    "border-2 border-ink/20 bg-paper-white text-ink hover:border-ink/35 hover:bg-paper active:translate-y-px",
  ghost: "bg-transparent text-ink-soft hover:bg-ink/[0.06] hover:text-ink",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:active:translate-y-0",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
