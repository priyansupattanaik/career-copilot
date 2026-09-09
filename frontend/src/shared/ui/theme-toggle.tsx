import { useTheme } from "@/shared/theme";
import { CopilotIcon } from "@/components/ui/copilot-icons";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const label = theme === "light" ? "Theme: light. Switch to dark mode." : "Theme: dark. Switch to light mode.";
  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " theme-toggle-compact" : ""}`}
      onClick={cycleTheme}
      aria-label={label}
      title={label}
    >
      <CopilotIcon name={resolvedTheme === "light" ? "sun" : "moon"} size={17} />
      {!compact && <span>{theme === "light" ? "Light" : "Dark"}</span>}
    </button>
  );
}
