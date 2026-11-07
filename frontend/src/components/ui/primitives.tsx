import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#294b39] hover:shadow-md disabled:bg-forest/40",
  secondary:
    "border border-forest/15 bg-white text-forest hover:-translate-y-0.5 hover:border-forest/30 hover:bg-cream",
  destructive:
    "bg-[#a9443c] text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#913a33] disabled:bg-[#a9443c]/50",
  ghost: "bg-transparent text-forest hover:bg-forest/5",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-xl px-3.5 text-sm",
  md: "min-h-11 rounded-[0.85rem] px-5 text-sm",
  lg: "min-h-12 rounded-2xl px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:transform-none disabled:cursor-not-allowed ${buttonStyles[variant]} ${buttonSizes[size]} ${className}`}
      type={type}
      {...props}
    />
  );
}

interface FieldLabelProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
}

function FieldLabel({ label, hint, error, htmlFor }: FieldLabelProps) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label className="text-sm font-semibold text-charcoal" htmlFor={htmlFor}>
        {label}
      </label>
      {error ? (
        <span className="text-xs font-medium text-[#a9443c]">{error}</span>
      ) : hint ? (
        <span className="text-xs text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

export interface InputFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function InputField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: InputFieldProps) {
  const fieldId = id ?? props.name;
  if (!fieldId) {
    throw new Error("InputField requires an id or name.");
  }

  return (
    <div>
      <FieldLabel
        error={error}
        hint={hint}
        htmlFor={fieldId}
        label={label}
      />
      <input
        aria-describedby={error ? `${fieldId}-error` : undefined}
        aria-invalid={Boolean(error)}
        className={`ds-field ${error ? "border-[#a9443c]" : ""} ${className}`}
        id={fieldId}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-[#a9443c]" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectFieldProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
}

export function SelectField({
  label,
  options,
  hint,
  error,
  id,
  className = "",
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? props.name;
  if (!fieldId) {
    throw new Error("SelectField requires an id or name.");
  }

  return (
    <div>
      <FieldLabel
        error={error}
        hint={hint}
        htmlFor={fieldId}
        label={label}
      />
      <select
        aria-describedby={error ? `${fieldId}-error` : undefined}
        aria-invalid={Boolean(error)}
        className={`ds-field ${error ? "border-[#a9443c]" : ""} ${className}`}
        id={fieldId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1.5 text-xs text-[#a9443c]" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ds-card ${className}`}>{children}</section>;
}

export type BadgeTone =
  | "forest"
  | "sage"
  | "blush"
  | "butter"
  | "lavender"
  | "powder"
  | "neutral"
  | "danger";

const badgeStyles: Record<BadgeTone, string> = {
  forest: "bg-forest text-white",
  sage: "bg-[#e6efe3] text-[#365c48]",
  blush: "bg-blush text-[#704641]",
  butter: "bg-butter text-[#68551e]",
  lavender: "bg-lavender text-[#514a72]",
  powder: "bg-powder text-[#355463]",
  neutral: "bg-[#f0f1ed] text-[#58615a]",
  danger: "bg-[#f7e5e2] text-[#913a33]",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export interface TableColumn<Row> {
  header: string;
  accessor: keyof Row | ((row: Row) => ReactNode);
  className?: string;
}

export function DataTable<Row extends { id: string | number }>({
  columns,
  rows,
  emptyMessage = "Nothing to show yet.",
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
}) {
  return (
    <div className="ds-scrollbar overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-charcoal/10 bg-cream/70">
            {columns.map((column) => (
              <th
                className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 ${column.className ?? ""}`}
                key={column.header}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal/5">
          {rows.length ? (
            rows.map((row) => (
              <tr className="hover:bg-cream/50" key={row.id}>
                {columns.map((column) => (
                  <td
                    className={`px-5 py-4 text-charcoal ${column.className ?? ""}`}
                    key={column.header}
                  >
                    {typeof column.accessor === "function"
                      ? column.accessor(row)
                      : String(row[column.accessor])}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                className="px-5 py-8 text-center text-slate-500"
                colSpan={columns.length}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SearchBar({
  label = "Search",
  placeholder = "Search...",
  className = "",
  ...props
}: Omit<InputFieldProps, "label"> & { label?: string }) {
  const searchId = props.id ?? props.name ?? "search";

  return (
    <div className={`relative ${className}`}>
      <label className="sr-only" htmlFor={searchId}>
        {label}
      </label>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <input
        className="ds-field pl-10"
        id={searchId}
        placeholder={placeholder}
        type="search"
        {...props}
      />
    </div>
  );
}

export function FilterChip({
  active = false,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-4 text-sm font-medium ${active ? "border-forest bg-forest text-white" : "border-charcoal/15 bg-white text-charcoal hover:border-forest/40 hover:bg-cream"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function LoadingSkeleton({
  className = "",
  variant = "text",
}: {
  className?: string;
  variant?: "text" | "circle" | "card";
}) {
  const variants = {
    text: "h-4 w-full rounded-md",
    circle: "h-11 w-11 rounded-full",
    card: "h-32 w-full rounded-2xl",
  };
  return (
    <span
      aria-label="Loading"
      className={`block animate-pulse bg-[#e9ece6] ${variants[variant]} ${className}`}
      role="status"
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-cream/50 px-6 py-10 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-sage/30 text-forest"
      >
        <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
          <path
            d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
      <h3 className="font-semibold text-charcoal">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
