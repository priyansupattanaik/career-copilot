import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  Checkbox as RadixCheckbox,
  Collapsible as RadixCollapsible,
  Dialog as RadixDialog,
  DropdownMenu as RadixDropdown,
  Switch as RadixSwitch,
  Tabs as RadixTabs,
  Toast as RadixToast,
  Tooltip as RadixTooltip,
} from "radix-ui";
import { useReducedMotion } from "motion/react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { isDevBuild } from "@/shared/config/env";
import { cn } from "@/shared/utils";

/* ==========================================================================
   PageHeader
   - Serif display title (Instrument Serif) with italic for emphasized word
   - Max 62ch description
   - Optional actions
   ========================================================================== */

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  overline?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  overline,
  className,
}: PageHeaderProps) {
  // Parses markdown-like *word* to <em>word</em> for Instrument Serif italic accent
  function renderEmphasizedTitle(raw: string) {
    if (!raw.includes("*")) {
      return raw;
    }
    const parts = raw.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  }

  return (
    <header className={cn("wb-page-header", className)}>
      <div className="wb-page-header-main">
        {overline ? (
          <p className="wb-stat-overline" style={{ marginBottom: 6 }}>
            {overline}
          </p>
        ) : null}
        <h1 className="wb-page-title">{renderEmphasizedTitle(title)}</h1>
        {description ? (
          <p className="wb-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="wb-page-header-actions">{actions}</div>
      ) : null}
    </header>
  );
}

/* ==========================================================================
   Surface
   - One level only, never nested.
   - Hairline border, background --surface-1, radius 12px.
   ========================================================================== */

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

export function Surface({
  as: Component = "section",
  children,
  className,
  ...props
}: SurfaceProps) {
  return (
    <Component className={cn("wb-surface", className)} {...props}>
      {children}
    </Component>
  );
}

/* ==========================================================================
   Button
   - 40px height (44px on coarse)
   - Primary (accent), Secondary (hairline), Ghost, Destructive
   - Press scale 0.98
   - Preserves width when loading with internal spinner
   ========================================================================== */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "wb-button",
          `wb-button-${variant}`,
          loading && "is-loading",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              lineHeight: 1,
            }}
          >
            <CopilotIcon name="loader" size={15} loop />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

/* ==========================================================================
   Underline Tabs
   - Accessible underline navigation
   ========================================================================== */

export const Tabs = RadixTabs.Root;
export const TabsList = forwardRef<
  HTMLDivElement,
  RadixTabs.TabsListProps
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn("wb-tabs", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  RadixTabs.TabsTriggerProps
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn("wb-tab-item", className)}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = RadixTabs.Content;

/* ==========================================================================
   SegmentedControl (e.g. 3 / 5 / 8 questions)
   ========================================================================== */

export interface SegmentedControlProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel = "Options",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("wb-segmented-control", className)}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={cn("wb-segmented-item", isSelected && "is-active")}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   RadioCard & RadioCardGroup
   - Selected = 1.5px accent border + --accent-soft fill + filled radio dot
   - Unselected = hairline
   ========================================================================== */

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description: string;
}

export interface RadioCardGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly RadioCardOption<T>[] | RadioCardOption<T>[];
  name?: string;
  className?: string;
}

export function RadioCardGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: RadioCardGroupProps<T>) {
  const generatedId = useId();
  const groupName = name || generatedId;

  return (
    <div className={cn("wb-radio-grid", className)} role="radiogroup">
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn("wb-radio-card", isSelected && "is-selected")}
            onClick={() => onChange(opt.value)}
          >
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={isSelected}
              onChange={() => onChange(opt.value)}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
            />
            <span className="wb-radio-dot" aria-hidden="true">
              <span className="wb-radio-dot-inner" />
            </span>
            <span className="wb-radio-content">
              <span className="wb-radio-title">{opt.title}</span>
              <span className="wb-radio-desc">{opt.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Switch (Accessible Radix Switch with label)
   ========================================================================== */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  disabled,
}: SwitchProps) {
  return (
    <label className="wb-switch-label" htmlFor={id}>
      <span className="wb-switch-title">{label}</span>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="wb-switch-root"
      >
        <RadixSwitch.Thumb className="wb-switch-thumb" />
      </RadixSwitch.Root>
    </label>
  );
}

/* ==========================================================================
   Checkbox
   - 18px box, radius sm, border --border-control, checked fill --accent
   - Accessible label click toggle, focus ring
   ========================================================================== */

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  onChange,
  label,
  disabled,
  className,
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const handleChange = onCheckedChange || onChange;

  return (
    <label
      htmlFor={inputId}
      className={cn("wb-checkbox-label", disabled && "is-disabled", className)}
    >
      <RadixCheckbox.Root
        id={inputId}
        checked={checked}
        onCheckedChange={(val) => handleChange?.(Boolean(val))}
        disabled={disabled}
        className="wb-checkbox-root"
      >
        <RadixCheckbox.Indicator className="wb-checkbox-indicator">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2 6 4.5 9 10 3" />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label ? <span className="wb-checkbox-text">{label}</span> : null}
    </label>
  );
}

/* ==========================================================================
   Chip
   - Fully round pill chip
   ========================================================================== */

export interface ChipProps extends HTMLAttributes<HTMLButtonElement | HTMLSpanElement> {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  asButton?: boolean;
}

export function Chip({
  children,
  active,
  onClick,
  asButton = true,
  className,
  ...props
}: ChipProps) {
  if (asButton || onClick) {
    return (
      <button
        type="button"
        className={cn("wb-chip", active && "is-active", className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={cn("wb-chip", className)} {...(props as HTMLAttributes<HTMLSpanElement>)}>
      {children}
    </span>
  );
}

/* ==========================================================================
   Stat
   - Overline label (uppercase)
   - Tabular mono value
   - Secondary text
   ========================================================================== */

export interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function Stat({ label, value, sub, className }: StatProps) {
  return (
    <div className={cn("wb-stat", className)}>
      <span className="wb-stat-overline">{label}</span>
      <span className="wb-stat-value">{value}</span>
      {sub ? <span className="wb-stat-sub">{sub}</span> : null}
    </div>
  );
}

/* ==========================================================================
   ScoreRing
   - Thin 6px stroke SVG, role="progressbar", aria-valuenow
   - Draws once over 700ms, number counts up over 600ms
   - Disabled with prefers-reduced-motion
   ========================================================================== */

export interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  label?: string;
  hideLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function ScoreRing({
  score,
  size = 100,
  strokeWidth = 6,
  label = "Readiness",
  hideLabel = false,
  compact = false,
  className,
}: ScoreRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const numericScore =
    score != null && Number.isFinite(Number(score))
      ? Math.max(0, Math.min(100, Math.round(Number(score))))
      : null;

  const [displayNumber, setDisplayNumber] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (numericScore === null) return;
    if (reduceMotion) {
      setDisplayNumber(numericScore);
      return;
    }

    const duration = 600;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayNumber(Math.round(ease * (numericScore ?? 0)));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [numericScore, reduceMotion]);

  const targetOffset =
    numericScore != null
      ? circumference - (numericScore / 100) * circumference
      : circumference;
  const strokeDashoffset = mounted || reduceMotion ? targetOffset : circumference;

  return (
    <div
      className={cn("wb-score-ring", (compact || size <= 64) && "is-compact", className)}
      style={{ width: size, height: size }}
      data-compact={compact || size <= 64 ? "true" : undefined}
      role="progressbar"
      aria-label={`${label}: ${numericScore != null ? numericScore + "%" : "unknown"}`}
      aria-valuenow={numericScore ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        className="wb-score-ring-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="wb-score-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {numericScore != null ? (
          <circle
            className="wb-score-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div
        className={cn(
          "wb-score-ring-center",
          (compact || size <= 64 || hideLabel) && "is-compact"
        )}
        aria-hidden="true"
      >
        <span className="wb-score-ring-num">
          {numericScore != null ? displayNumber : "—"}
        </span>
        {!hideLabel && size > 64 && label ? (
          <span className="wb-score-ring-label">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ==========================================================================
   EmptyState
   - Headline, one sentence, one CTA
   ========================================================================== */

export interface EmptyStateProps {
  headline: string;
  description: string;
  cta?: ReactNode;
  spotDrawing?: ReactNode;
  className?: string;
}

export function EmptyState({
  headline,
  description,
  cta,
  spotDrawing,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("wb-empty-state", className)}>
      <div className="wb-empty-spot" aria-hidden="true">
        {spotDrawing ?? (
          <svg
            width="44"
            height="44"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="10" width="32" height="28" rx="4" />
            <path d="M16 20h16" />
            <path d="M16 26h10" />
            <circle cx="34" cy="27" r="2" fill="var(--accent)" stroke="none" />
          </svg>
        )}
      </div>
      <h3 className="wb-empty-headline">{headline}</h3>
      <p className="wb-empty-sentence">{description}</p>
      {cta ? <div>{cta}</div> : null}
    </div>
  );
}

/* ==========================================================================
   InlineNotice (info / warn / error)
   ========================================================================== */

export interface InlineNoticeProps {
  tone?: "info" | "warn" | "error";
  message: string;
  action?: ReactNode;
  className?: string;
  details?: string;
}

export function InlineNotice({
  tone = "info",
  message,
  action,
  className,
  details,
}: InlineNoticeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("wb-notice", `wb-notice-${tone}`, className)}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0 }}>{message}</p>
        {details && isDevBuild ? (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowDetails((p) => !p)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 12,
                cursor: "pointer",
                color: "inherit",
                textDecoration: "underline",
              }}
            >
              {showDetails ? "Hide technical details" : "Details"}
            </button>
            {showDetails ? (
              <pre
                style={{
                  margin: "8px 0 0 0",
                  padding: 8,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  background: "var(--surface-2)",
                  borderRadius: 6,
                  overflowX: "auto",
                }}
              >
                {details}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
      {action ? <div className="wb-notice-action">{action}</div> : null}
    </div>
  );
}

/* ==========================================================================
   Skeleton (Quiet static or subtle pulse matching layout)
   ========================================================================== */

export function Skeleton({
  width,
  height = 20,
  className,
  style,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("wb-skeleton", className)}
      style={{
        width: width ?? "100%",
        height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/* ==========================================================================
   DropdownMenu (Radix primitive wrappers)
   ========================================================================== */

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuPortal = RadixDropdown.Portal;
export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  RadixDropdown.DropdownMenuContentProps
>(({ className, ...props }, ref) => (
  <RadixDropdown.Content
    ref={ref}
    className={cn("wb-dropdown-content", className)}
    sideOffset={4}
    {...props}
  />
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  RadixDropdown.DropdownMenuItemProps & { isDanger?: boolean }
>(({ className, isDanger, ...props }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    className={cn("wb-dropdown-item", isDanger && "is-danger", className)}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  RadixDropdown.DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <RadixDropdown.Separator
    ref={ref}
    className={cn("wb-dropdown-separator", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

/* ==========================================================================
   Tooltip (Radix Tooltip wrappers)
   ========================================================================== */

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipContent = forwardRef<
  HTMLDivElement,
  RadixTooltip.TooltipContentProps
>(({ className, ...props }, ref) => (
  <RadixTooltip.Content
    ref={ref}
    className={cn("wb-tooltip-content", className)}
    sideOffset={6}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";

/* ==========================================================================
   Collapsible (Radix Collapsible wrappers)
   ========================================================================== */

export const Collapsible = RadixCollapsible.Root;
export const CollapsibleTrigger = RadixCollapsible.Trigger;
export const CollapsibleContent = RadixCollapsible.Content;

/* ==========================================================================
   Sheet (Radix Dialog bottom sheet with drag handle)
   ========================================================================== */

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;
export const SheetPortal = RadixDialog.Portal;

export const SheetOverlay = forwardRef<
  HTMLDivElement,
  RadixDialog.DialogOverlayProps
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={cn("wb-sheet-overlay", className)}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = forwardRef<
  HTMLDivElement,
  RadixDialog.DialogContentProps & { title?: string; showHandle?: boolean }
>(({ className, children, title, showHandle = true, ...props }, ref) => (
  <RadixDialog.Portal>
    <SheetOverlay />
    <RadixDialog.Content
      ref={ref}
      className={cn("wb-sheet-content", className)}
      {...props}
    >
      {showHandle ? <div className="wb-sheet-handle" aria-hidden="true" /> : null}
      {title ? (
        <RadixDialog.Title className="wb-sheet-title">{title}</RadixDialog.Title>
      ) : (
        <RadixDialog.Title className="sr-only">Panel</RadixDialog.Title>
      )}
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
SheetContent.displayName = "SheetContent";

/* ==========================================================================
   Toast with Undo
   - 5-10s timer with optional undo callback
   ========================================================================== */

export interface ToastOptions {
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastOptions & { id: string })[]>([]);

  function showToast(options: ToastOptions) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...options, id }]);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      <RadixToast.Provider swipeDirection="down">
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            duration={t.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) {
                setToasts((prev) => prev.filter((item) => item.id !== t.id));
              }
            }}
            className="wb-toast-root"
          >
            <p className="wb-toast-message">{t.message}</p>
            {t.onUndo ? (
              <RadixToast.Action asChild altText={t.undoLabel || "Undo"}>
                <button
                  type="button"
                  className="wb-toast-undo"
                  onClick={() => {
                    t.onUndo?.();
                    setToasts((prev) => prev.filter((item) => item.id !== t.id));
                  }}
                >
                  {t.undoLabel || "Undo"}
                </button>
              </RadixToast.Action>
            ) : null}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="wb-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
