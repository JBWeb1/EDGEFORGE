import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-navy-700 bg-navy-850/80 p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-white">{children}</h2>
      {action}
    </div>
  );
}

const buttonStyles = {
  primary: "bg-electric text-white hover:bg-electric-soft shadow-[0_0_20px_-6px] shadow-electric",
  secondary: "border border-navy-600 bg-navy-800 text-navy-200 hover:border-navy-400 hover:text-white",
  ghost: "text-navy-300 hover:bg-navy-800 hover:text-white",
  danger: "border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20",
};

type Variant = keyof typeof buttonStyles;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(buttonBase, buttonStyles[variant], className)} {...props} />;
}

const inputBase =
  "w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputBase, "appearance-auto", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-navy-300">
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="text-xs text-navy-400">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-loss">
          {e}
        </p>
      ))}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "profit" | "loss" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "border-navy-600 text-navy-300",
    profit: "border-profit/40 bg-profit/10 text-profit",
    loss: "border-loss/40 bg-loss/10 text-loss",
    info: "border-electric/40 bg-electric/10 text-electric-soft",
  };
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Stat({ label, value, hint, valueClass }: { label: string; value: ReactNode; hint?: ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-850/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-navy-400">{label}</p>
      <p className={cn("num mt-2 text-2xl font-semibold text-white", valueClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-navy-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children && <div className="max-w-md text-sm text-navy-300">{children}</div>}
      {action}
    </Card>
  );
}

export function FormMessage({ state }: { state: { ok?: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        state.ok ? "border-profit/40 bg-profit/10 text-profit" : "border-loss/40 bg-loss/10 text-loss",
      )}
    >
      {state.message}
    </p>
  );
}
