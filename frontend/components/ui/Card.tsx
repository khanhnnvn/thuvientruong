import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-ink/10 bg-paper-white shadow-pin", className)}>{children}</div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-b border-ink/10 px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("font-display text-base font-semibold tracking-tight text-ink", className)}>{children}</h2>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

type Tone = "blue" | "orange" | "brick" | "green";

const TONE_FILL: Record<Tone, string> = {
  blue: "bg-board-blue-dark",
  orange: "bg-board-orange-dark",
  brick: "bg-board-brick-dark",
  green: "bg-board-green-dark",
};

const TONE_TINT_BG: Record<Tone, string> = {
  blue: "bg-board-blue/12",
  orange: "bg-board-orange/16",
  brick: "bg-board-brick/12",
  green: "bg-board-green/14",
};

const TONE_TINT_TEXT: Record<Tone, string> = {
  blue: "text-board-blue-dark",
  orange: "text-board-orange-dark",
  brick: "text-board-brick-dark",
  green: "text-board-green-dark",
};

/**
 * The one deliberately oversized emphasis block per screen — a big tabular
 * number pinned on a solid board-marker fill. Use exactly once per screen
 * (`size="lg"`); everything else on that screen should read smaller.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  size = "sm",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  size?: "sm" | "lg";
  hint?: string;
  className?: string;
}) {
  if (size === "lg") {
    return (
      <div
        className={cn("animate-pin-in relative rounded-2xl p-4 text-paper-white shadow-pin-lg sm:p-5", TONE_FILL[tone], className)}
        style={{ "--pin-rotate": "-0.6deg" } as React.CSSProperties}
      >
        <span className="absolute -top-2 left-6 h-4 w-4 rounded-full bg-paper-white shadow-pin-sm" />
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-white/15">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-paper-white/80">{label}</p>
            <p className="tnum font-display text-3xl font-extrabold leading-none sm:text-4xl">{value}</p>
          </div>
        </div>
        {hint && (
          <p className="mt-3 border-t border-paper-white/20 pt-3 text-sm text-paper-white/85">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-ink/10 bg-paper-white px-4 py-3", className)}>
      {Icon && (
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONE_TINT_BG[tone], TONE_TINT_TEXT[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-soft">{label}</p>
        <p className="tnum font-display text-xl font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}
