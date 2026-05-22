import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(17,78,109,0.2)]";

const controlBase =
  "min-h-10 w-full rounded-[7px] border border-[color:var(--ui-border,#D7E4ED)] bg-white px-3 py-2 text-sm text-[color:var(--ui-text-primary,#123348)] outline-none transition placeholder:text-[color:var(--ui-text-secondary,#657D8F)] focus:border-[color:var(--brand-primary,#114E6D)] focus:ring-2 focus:ring-[rgba(17,78,109,0.14)]";

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary:
      "border border-[color:var(--brand-primary,#114E6D)] bg-[color:var(--brand-primary,#114E6D)] text-white hover:bg-[color:var(--brand-deep,#0F3C55)]",
    secondary:
      "border border-[color:var(--ui-border,#D7E4ED)] bg-white text-[color:var(--brand-deep,#0F3C55)] hover:bg-[color:var(--brand-soft,#F4F9FC)]",
    ghost:
      "border border-transparent bg-transparent text-[color:var(--brand-deep,#0F3C55)] hover:bg-[color:var(--brand-soft,#F4F9FC)]",
    danger: "border border-red-600 bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={cx(
        "inline-flex min-h-10 items-center justify-center rounded-[7px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        focusRing,
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cx(
        "rounded-lg border border-[color:var(--ui-border,#D7E4ED)] bg-white p-5 shadow-[0_16px_34px_rgba(18,51,72,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputProps) {
  return <input className={cx(controlBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cx(controlBase, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: SelectProps) {
  return <select className={cx(controlBase, className)} {...props} />;
}

export function MultiSelect({ className, ...props }: SelectProps) {
  return <Select multiple className={cx("min-h-32", className)} {...props} />;
}

export function Badge({ className, children, ...props }: SpanProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[6px] border border-[rgba(17,78,109,0.14)] bg-[color:var(--brand-soft,#F4F9FC)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-deep,#0F3C55)]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  children,
}: {
  status: "success" | "warning" | "error" | "neutral";
  children: React.ReactNode;
}) {
  const map = {
    success: "border-[#CFE7B6] bg-[#EDF7E2] text-[#315C0B]",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-[color:var(--ui-border,#D7E4ED)] bg-[#F4F9FC] text-[#365770]",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[6px] border px-2.5 py-1 text-xs font-semibold",
        map[status],
      )}
    >
      {children}
    </span>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  emptyLabel = "Sin datos",
}: {
  rows: T[];
  columns: Array<{ key: keyof T; label: string }>;
  emptyLabel?: string;
}) {
  if (!rows.length) return <EmptyState title={emptyLabel} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--ui-border,#D7E4ED)] bg-white">
      <table className="w-full min-w-[680px] border-collapse text-sm text-[color:var(--ui-text-primary,#123348)]">
        <thead className="bg-[#EAF3F8] text-left text-[color:var(--brand-deep,#0F3C55)]">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className="px-4 py-3 font-semibold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-[color:var(--ui-border,#D7E4ED)]"
            >
              {columns.map((column) => (
                <td key={String(column.key)} className="px-4 py-3">
                  {String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-xl">
        <h2 className="text-lg font-bold text-[color:var(--brand-deep,#0F3C55)]">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </Card>
    </div>
  );
}

export function Drawer({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <aside
      className={cx(
        "fixed right-0 top-0 z-40 h-full w-full max-w-md bg-white shadow-2xl transition-transform",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {children}
    </aside>
  );
}

export function Sidebar({ className, ...props }: DivProps) {
  return (
    <aside
      className={cx(
        "h-full w-72 border-r border-[color:var(--ui-border,#D7E4ED)] bg-white",
        className,
      )}
      {...props}
    />
  );
}

export function Topbar({ className, ...props }: DivProps) {
  return (
    <header
      className={cx(
        "sticky top-0 z-20 border-b border-[color:var(--ui-border,#D7E4ED)] bg-white/90 px-4 py-3 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title = "Sin información",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--ui-border,#D7E4ED)] bg-white p-8 text-center">
      <p className="font-semibold text-[color:var(--brand-deep,#0F3C55)]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[#657D8F]">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return <div className="rounded-lg bg-white p-6 text-sm text-[#657D8F]">{label}</div>;
}

export function ErrorState({ message = "Ocurrió un error" }: { message?: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <p className="text-sm text-[#657D8F]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[color:var(--brand-deep,#0F3C55)]">
        {value}
      </p>
    </Card>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--brand-deep,#0F3C55)]">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-[#657D8F]">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-[color:var(--brand-deep,#0F3C55)]">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-[#657D8F]">{hint}</span> : null}
    </label>
  );
}

export function FileUpload(props: InputProps) {
  return <Input type="file" {...props} />;
}

export function ExportButton(props: ButtonProps) {
  return <Button variant="secondary" {...props} />;
}

export function ResponsiveContainer({ className, ...props }: DivProps) {
  return (
    <div
      className={cx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
