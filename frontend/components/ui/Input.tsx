"use client";

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border-2 border-ink/15 bg-paper-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-board-blue focus:outline-none focus:ring-2 focus:ring-board-blue/20 disabled:cursor-not-allowed disabled:bg-ink/5 disabled:text-ink-faint";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...props} />
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(fieldBase, "w-full appearance-none pr-9")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
    </div>
  )
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, "min-h-24 resize-y", className)} {...props} />
);
Textarea.displayName = "Textarea";

export function Label({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {required && <span className="ml-0.5 text-board-brick-dark">*</span>}
    </label>
  );
}

export function FormField({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}
