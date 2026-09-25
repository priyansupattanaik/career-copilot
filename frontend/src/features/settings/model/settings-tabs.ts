import type { CopilotIconName } from "@/components/ui/copilot-icons";

export type SettingsTabItem = {
  href: string;
  label: string;
  icon: CopilotIconName;
};

export const SETTINGS_TABS: readonly SettingsTabItem[] = [
  { href: "/settings/profile", label: "Candidate Profile", icon: "profile" },
  { href: "/settings/account", label: "Account & Access", icon: "account" },
  { href: "/settings/preferences", label: "Preferences", icon: "settings" },
  { href: "/settings/privacy", label: "Privacy Controls", icon: "evidence" },
] as const;
