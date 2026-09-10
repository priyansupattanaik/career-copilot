import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { cn } from "@/shared/utils";
import { extractSelectOptions } from "@/shared/ui/select-options";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function emitChange(onChange: SelectProps["onChange"], value: string) {
  if (!onChange) return;
  onChange({
    target: { value },
    currentTarget: { value },
  } as Parameters<NonNullable<SelectProps["onChange"]>>[0]);
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      disabled,
      id,
      name,
      required,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
    },
    ref,
  ) {
    const options = useMemo(() => extractSelectOptions(children), [children]);
    const isControlled = value !== undefined;
    const [uncontrolled, setUncontrolled] = useState(
      defaultValue == null ? "" : String(defaultValue),
    );
    const selectedValue = isControlled ? String(value ?? "") : uncontrolled;
    const selected = options.find((item) => item.value === selectedValue);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const ignoreClick = useRef(false);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [menuBox, setMenuBox] = useState<{
      top: number;
      left: number;
      width: number;
      maxHeight: number;
    } | null>(null);
    const listId = useId();

    function optionId(index: number) {
      return `${listId}-opt-${index}`;
    }

    function commit(next: string) {
      if (!isControlled) setUncontrolled(next);
      emitChange(onChange, next);
      setOpen(false);
      triggerRef.current?.focus();
    }

    function placeMenu() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gutter = 8;
      const width = Math.max(rect.width, 180);
      const estimated = Math.min(280, window.innerHeight - gutter * 2);
      const spaceBelow = window.innerHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(estimated, openUp ? spaceAbove : spaceBelow),
      );
      setMenuBox({
        top: openUp
          ? Math.max(gutter, rect.top - maxHeight - 6)
          : rect.bottom + 6,
        left: Math.min(
          rect.left,
          Math.max(gutter, window.innerWidth - width - gutter),
        ),
        width,
        maxHeight,
      });
    }

    function moveHighlight(from: number, delta: number) {
      if (!options.length) return from;
      let next = from;
      for (let step = 0; step < options.length; step += 1) {
        next = (next + delta + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      return next;
    }

    useEffect(() => {
      if (!open) return;
      const selectedIndex = options.findIndex(
        (item) => item.value === selectedValue && !item.disabled,
      );
      setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
      placeMenu();
      const onDoc = (event: MouseEvent) => {
        const target = event.target as Node;
        if (triggerRef.current?.contains(target)) return;
        if (menuRef.current?.contains(target)) return;
        ignoreClick.current = true;
        setOpen(false);
      };
      const onReposition = () => placeMenu();
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("resize", onReposition);
        window.removeEventListener("scroll", onReposition, true);
      };
      // Highlight is seeded only when the menu opens, not on parent re-renders.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const active = menuRef.current?.querySelector<HTMLElement>(
        '[data-highlighted="true"]',
      );
      active?.scrollIntoView({ block: "nearest" });
    }, [highlight, open]);

    function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (event.key === "Tab") {
        setOpen(false);
        return;
      }
      if (event.key === "Escape") {
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setHighlight((current) => moveHighlight(current, 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setHighlight((current) => moveHighlight(current, -1));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const item = options[highlight];
        if (item && !item.disabled) commit(item.value);
      }
    }

    return (
      <div className={cn("cc-select", className)}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="field cc-select-trigger"
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(highlight) : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onClick={() => {
            if (disabled) return;
            if (ignoreClick.current) {
              ignoreClick.current = false;
              return;
            }
            setOpen((current) => !current);
          }}
          onKeyDown={onTriggerKey}
        >
          <span
            className={cn(
              "cc-select-value",
              !selected?.label && "is-placeholder",
            )}
          >
            {selected?.label || "Select"}
          </span>
          <CopilotIcon name="expand" size={16} />
        </button>
        <select
          ref={ref}
          className="cc-select-native"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          disabled={disabled}
          value={selectedValue}
          onChange={() => undefined}
        >
          {options.map((item) => (
            <option
              key={`${item.value}-${item.label}`}
              value={item.value}
              disabled={item.disabled}
            >
              {item.label}
            </option>
          ))}
        </select>
        {open && menuBox && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                id={listId}
                className="cc-select-menu menu-surface"
                role="listbox"
                aria-label={ariaLabel || "Options"}
                style={{
                  top: menuBox.top,
                  left: menuBox.left,
                  width: menuBox.width,
                  maxHeight: menuBox.maxHeight,
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                }}
              >
                {options.map((item, index) => (
                  <div
                    key={`${item.value}-${item.label}-${index}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={item.value === selectedValue}
                    aria-disabled={item.disabled || undefined}
                    data-highlighted={highlight === index ? "true" : undefined}
                    className={cn(
                      "cc-select-option",
                      item.value === selectedValue && "is-selected",
                      highlight === index && "is-active",
                      item.disabled && "is-disabled",
                    )}
                    onMouseEnter={() => {
                      if (!item.disabled) setHighlight(index);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (!item.disabled) commit(item.value);
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  },
);

Select.displayName = "Select";
