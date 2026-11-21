import { usePathname } from "@/shared/router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "@/shared/ui/router-link";
import LoadingState from "@/components/ui/loading-state";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/shared/api/client";
import { deleteAccount as deleteAccountRequest, saveSettingsRecord } from "../api";
import { createClient } from "@/features/auth/api/client";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
} from "@/shared/ui/primitives";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { motion, useReducedMotion } from "motion/react";
import { FLUID_SPRING_TRANSITION } from "@/components/ui/motion-system";
import { cn } from "@/shared/utils";
import { notifyProfileUpdated } from "@/features/profile/model/profile-completion";
import {
  isPublicProfileUsername,
  normalizePublicProfileUsername,
} from "@/features/profile/model/public-profile-username";
import { SETTINGS_TABS } from "../model/settings-tabs";
import "../profile-v2.css";
import { ProfileOverhaulView } from "./profile-overhaul/profile-overhaul-view";

function profileInitials(name: unknown): string {
  const initials = String(name || "U")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "U";
}

function Frame({
  children,
  title,
  description,
  className,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const path = usePathname();
  return (
    <div className={cn("feature-page settings-page profile-v2", className)}>
      <PageHeader title={title} description={description} />
      <nav className="settings-nav" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => {
          const active = path === tab.href;
          return (
            <Link
              key={tab.href}
              className={cn("settings-nav-tab", active && "is-active")}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              style={{ position: "relative" }}
            >
              {active && (
                <motion.span
                  layoutId="settings-tab-pill"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : FLUID_SPRING_TRANSITION
                  }
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    background: "var(--ps-panel, var(--surface))",
                    border: "1px solid var(--ps-line, var(--border))",
                    boxShadow:
                      "0 1px 4px rgb(15 23 42 / 08%), 0 2px 8px rgb(15 23 42 / 06%)",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
              )}
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CopilotIcon name={tab.icon} size={15} />
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function ProfileSettings() {
  return (
    <Frame
      title="Profile"
      description="Manage your candidate profile, resume, and career preferences."
    >
      <span className="sr-only" aria-hidden="true">
        <p className="eyebrow" id="saved-resumes-title" style={{ margin: 0 }}>Saved resumes</p>
        <p className="eyebrow" id="upload-resume-title" style={{ margin: 0 }}>Upload resume</p>
      </span>
      <ProfileOverhaulView />
    </Frame>
  );
}

const DELETE_ACCOUNT_PHRASE = "DELETE MY ACCOUNT";

function UsernameChangeCard() {
  const [current, setCurrent] = useState("");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [availability, setAvailability] = useState<{
    available: boolean;
    reason?: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<{ profile?: { username?: string | null } }>("/profile")
      .then((result) => {
        if (!active) return;
        const username = normalizePublicProfileUsername(
          String(result.profile?.username || ""),
        );
        setCurrent(username);
        setDraft(username);
        setLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message || "Could not load username.");
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const value = normalizePublicProfileUsername(draft);
    if (!value) {
      setAvailability(null);
      return;
    }
    if (value === current) {
      setAvailability({ available: true });
      return;
    }
    if (!isPublicProfileUsername(value)) {
      setAvailability({
        available: false,
        reason:
          "Use 3–30 lowercase letters, numbers, and underscores (cannot start or end with _).",
      });
      return;
    }
    const timer = window.setTimeout(() => {
      void apiRequest<{
        available?: boolean;
        reason?: string | null;
      }>(`/profile/username/availability?username=${encodeURIComponent(value)}`)
        .then((result) =>
          setAvailability({
            available: Boolean(result.available),
            reason: result.reason,
          }),
        )
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft, current]);

  async function saveUsername() {
    setError("");
    setMessage("");
    const username = normalizePublicProfileUsername(draft);
    if (!isPublicProfileUsername(username)) {
      setError(
        "Username must be 3–30 lowercase letters, numbers, and underscores.",
      );
      return;
    }
    if (username === current) {
      setMessage("That is already your username.");
      return;
    }
    if (availability && availability.available === false) {
      setError(availability.reason || "That username is not available.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ username?: string }>(
        "/profile/username",
        {
          method: "PATCH",
          body: JSON.stringify({ username }),
        },
      );
      const saved = normalizePublicProfileUsername(
        String(result.username || username),
      );
      setCurrent(saved);
      setDraft(saved);
      notifyProfileUpdated();
      setMessage(
        `Username updated to @${saved}. Sign-in and your public profile now use /${saved}.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="stack settings-card">
      <h2 style={{ margin: 0 }}>Username</h2>
      <p className="muted" style={{ margin: 0 }}>
        Change the handle used for sign-in and your public profile URL.
      </p>
      {current ? (
        <p className="muted" style={{ margin: 0 }}>
          Current:{" "}
          <Link href={`/${encodeURIComponent(current)}`}>@{current}</Link>
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No username yet. Choose one to claim your public profile.
        </p>
      )}
      <label className="field-label">
        New username
        <Input
          autoComplete="username"
          minLength={3}
          maxLength={30}
          value={draft}
          disabled={!loaded || saving}
          onChange={(event: { target: { value: string } }) =>
            setDraft(event.target.value)
          }
          placeholder="your_name"
          aria-describedby="account-username-hint"
        />
        <span
          id="account-username-hint"
          className={
            availability && !availability.available ? "field-error" : "field-hint"
          }
        >
          {availability
            ? availability.available
              ? `Available: /${normalizePublicProfileUsername(draft)}`
              : availability.reason || "That username is not available."
            : "3–30 letters, numbers, and underscores."}
        </span>
      </label>
      <div className="cluster">
        <Button
          disabled={
            saving ||
            !loaded ||
            !normalizePublicProfileUsername(draft) ||
            availability?.available === false
          }
          onClick={() => void saveUsername()}
        >
          {saving ? "Saving username…" : "Save username"}
        </Button>
      </div>
      {message ? (
        <p role="status" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="field-error" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}

export function AccountSettings() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [authProvider, setAuthProvider] = useState<
    "email" | "google" | "unknown"
  >("unknown");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const authClient = createClient();
      if (!authClient) return;
      const {
        data: { user },
      } = await authClient.auth.getUser();
      if (active && user?.email) {
        setAccountEmail(user.email);
        setAuthProvider(user.auth_provider || "unknown");
      }
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await createClient()?.auth.signOut();
    navigate("/");
  }

  async function deleteAccount() {
    setError("");
    setMessage("");
    if (confirmPhrase.trim() !== DELETE_ACCOUNT_PHRASE) {
      setError(`Type exactly ${DELETE_ACCOUNT_PHRASE} to confirm.`);
      return;
    }
    if (
      accountEmail &&
      confirmEmail.trim().toLowerCase() !== accountEmail.toLowerCase()
    ) {
      setError("Email does not match your signed-in account.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccountRequest({
        confirmation: DELETE_ACCOUNT_PHRASE,
        email: confirmEmail.trim() || accountEmail || null,
      });
      await createClient()?.auth.signOut();
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const canDelete =
    confirmPhrase.trim() === DELETE_ACCOUNT_PHRASE &&
    (!accountEmail ||
      confirmEmail.trim().toLowerCase() === accountEmail.toLowerCase());

  const providerLabel =
    authProvider === "google"
      ? "Google"
      : authProvider === "email"
        ? "Email and password"
        : "Account session";

  return (
    <Frame
      title="Account"
      description="Sign out, or delete this account."
    >
      <div className="settings-canvas">
        <UsernameChangeCard />
        <Card className="stack settings-card settings-session-card">
          <h2 style={{ margin: 0 }}>Session</h2>
          <div className="settings-session-identity">
            <span className="settings-session-mark" aria-hidden="true">
              {profileInitials(accountEmail.split("@")[0] || "A")}
            </span>
            <div>
              <strong>{providerLabel}</strong>
              {accountEmail ? (
                <p className="muted">{accountEmail}</p>
              ) : (
                <p className="muted">Email is still loading.</p>
              )}
            </div>
          </div>
          <div className="cluster">
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
          {message && (
            <p role="status" style={{ margin: 0 }}>
              {message}
            </p>
          )}
          {error && !showDeletePanel && (
            <p role="alert" className="field-error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
        </Card>

        <Card className="stack settings-card settings-danger-card">
          <p className="eyebrow" style={{ margin: 0 }}>Danger zone</p>
          <h2 style={{ margin: 0 }}>Delete account</h2>
          <p
            className="muted"
            style={{ margin: 0, fontSize: "var(--text-sm)" }}
          >
            Permanently removes your account and all candidate data stored with
            us: profile, skills, experience, education, resumes and files, job
            descriptions, resume checks, interviews, study plans, saved jobs,
            activity, and preferences. This cannot be undone.
          </p>
          {!showDeletePanel ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeletePanel(true)}
            >
              I want to delete my account
            </Button>
          ) : (
            <div className="stack">
              <label className="field-label">
                Confirm your account email
                <Input
                  type="email"
                  autoComplete="email"
                  value={confirmEmail}
                  onChange={(e: any) => setConfirmEmail(e.target.value)}
                  placeholder={accountEmail || "you@example.com"}
                  disabled={deleting}
                />
              </label>
              <label className="field-label">
                <span>
                  Type <span className="mono">{DELETE_ACCOUNT_PHRASE}</span> to
                  confirm
                </span>
                <Input
                  value={confirmPhrase}
                  onChange={(e: any) => setConfirmPhrase(e.target.value)}
                  placeholder={DELETE_ACCOUNT_PHRASE}
                  disabled={deleting}
                  autoComplete="off"
                />
              </label>
              <div className="cluster">
                <Button
                  variant="destructive"
                  disabled={deleting || !canDelete}
                  onClick={() => void deleteAccount()}
                >
                  {deleting ? "Deleting…" : "Permanently delete account"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeletePanel(false);
                    setConfirmPhrase("");
                    setConfirmEmail("");
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              {error && (
                <p role="alert" className="field-error" style={{ margin: 0 }}>
                  {error}
                </p>
              )}
              <p
                className="muted"
                style={{ margin: 0, fontSize: "var(--text-xs)" }}
              >
                Account deletion is permanent. Make sure you really want to
                remove everything.
              </p>
            </div>
          )}
        </Card>
      </div>
    </Frame>
  );
}

function StoredSettings({
  kind,
  wrapCanvas = true,
}: {
  kind: "notifications" | "privacy";
  wrapCanvas?: boolean;
}) {
  const [data, setData] = useState<any>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<any>("/settings")
      .then((r) => {
        if (!active) return;
        setData(r[kind] || {});
        setError("");
      })
      .catch((e: any) => {
        if (!active) return;
        setError(e.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [kind]);
  async function save() {
    if (!loaded) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload =
        kind === "notifications"
          ? {
              job_alerts: Boolean(data.job_alerts),
              learning_reminders: Boolean(data.learning_reminders),
              interview_reminders: Boolean(data.interview_reminders),
              product_updates: Boolean(data.product_updates),
              email_frequency: data.email_frequency || "weekly",
            }
          : {
              camera_permission: data.camera_permission || "ask",
              microphone_permission: data.microphone_permission || "ask",
              recording_retention_days: Number(
                data.recording_retention_days || 0,
              ),
              resume_processing_consent: Boolean(
                data.resume_processing_consent,
              ),
              job_recommendation_consent: Boolean(
                data.job_recommendation_consent,
              ),
              profile_visibility: data.profile_visibility || "private",
            };
      if (kind === "privacy") {
        const days = Number(payload.recording_retention_days ?? 0);
        if (Number.isNaN(days) || days < 0 || days > 365) {
          throw new Error(
            "Recording retention must be between 0 and 365 days.",
          );
        }
      }
      await saveSettingsRecord(kind, payload);
      setMessage(
        kind === "notifications"
          ? "Notification preferences saved successfully."
          : "Privacy settings saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const notificationToggles = [
    {
      key: "job_alerts",
      label: "Job alerts",
      hint: "Email when new matching roles are available.",
    },
    {
      key: "learning_reminders",
      label: "Learning reminders",
      hint: "Reminders for study plans built from missing resume words.",
    },
    {
      key: "interview_reminders",
      label: "Interview reminders",
      hint: "Reminders for unfinished practice sessions.",
    },
    {
      key: "product_updates",
      label: "Product updates",
      hint: "Occasional notes about Career Copilot itself.",
    },
  ] as const;

  const consentToggles = [
    {
      key: "resume_processing_consent",
      label: "Allow resume processing",
      hint: "Extract and score resumes you upload and confirm.",
    },
    {
      key: "job_recommendation_consent",
      label: "Allow job recommendations",
      hint: "Score jobs using the resume you confirmed.",
    },
  ] as const;

  if (!loaded) {
    const loadingCard = (
      <Card className="settings-card">
        <LoadingState label="Loading settings" variant="Dots" />
      </Card>
    );
    return wrapCanvas ? (
      <div className="settings-canvas">{loadingCard}</div>
    ) : (
      loadingCard
    );
  }

  const content = kind === "notifications" ? (
        <Card className="stack settings-card">
          <h2 style={{ margin: 0 }}>Notification preferences</h2>
          <p className="muted" style={{ margin: 0 }}>
            These choices are stored on your account, not in this browser.
          </p>
          <label className="field-label">
            Email frequency
            <Select
              value={data.email_frequency || "weekly"}
              onChange={(e: any) =>
                setData({ ...data, email_frequency: e.target.value })
              }
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </label>
          <div className="settings-toggle-list">
            {notificationToggles.map((item) => (
              <label className="settings-toggle" key={item.key}>
                <span className="settings-toggle-copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(data[item.key])}
                  onChange={(e: any) =>
                    setData({ ...data, [item.key]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving preferences…" : "Save notification preferences"}
          </Button>
          {error ? (
            <p role="alert" className="field-error" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" style={{ margin: 0 }}>
              {message}
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="stack settings-card">
            <h2 style={{ margin: 0 }}>Profile visibility</h2>
            <label className="field-label">
              Who can see your profile
              <Select
                value={data.profile_visibility || "private"}
                onChange={(e: any) =>
                  setData({ ...data, profile_visibility: e.target.value })
                }
              >
                <option value="private">Private — only this account</option>
                <option value="limited">
                  Limited — only features you enable
                </option>
              </Select>
            </label>
            <div className="settings-toggle-list">
              {consentToggles.map((item) => (
                <label className="settings-toggle" key={item.key}>
                  <span className="settings-toggle-copy">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(data[item.key])}
                    onChange={(e: any) =>
                      setData({ ...data, [item.key]: e.target.checked })
                    }
                  />
                </label>
              ))}
            </div>
          </Card>
          <Card className="stack settings-card">
            <h2 style={{ margin: 0 }}>Camera and microphone</h2>
            <p className="muted" style={{ margin: 0 }}>
              These apply to mock-interview practice. The server does not invent
              camera data.
            </p>
            <div className="grid-2">
              <label className="field-label">
                Camera
                <Select
                  value={data.camera_permission || "ask"}
                  onChange={(e: any) =>
                    setData({ ...data, camera_permission: e.target.value })
                  }
                >
                  <option value="ask">Ask each session</option>
                  <option value="allowed">Allowed</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </label>
              <label className="field-label">
                Microphone
                <Select
                  value={data.microphone_permission || "ask"}
                  onChange={(e: any) =>
                    setData({ ...data, microphone_permission: e.target.value })
                  }
                >
                  <option value="ask">Ask each session</option>
                  <option value="allowed">Allowed</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </label>
              <label className="field-label">
                Recording retention (days)
                <Select
                  value={String(data.recording_retention_days ?? 0)}
                  onChange={(e: any) =>
                    setData({
                      ...data,
                      recording_retention_days: Number(e.target.value),
                    })
                  }
                >
                  {Array.from(
                    new Set([
                      0,
                      7,
                      30,
                      90,
                      180,
                      365,
                      Number(data.recording_retention_days ?? 0),
                    ]),
                  )
                    .filter(
                      (days) =>
                        Number.isFinite(days) && days >= 0 && days <= 365,
                    )
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <option key={days} value={days}>
                        {days === 0
                          ? "0 — do not keep recordings"
                          : `${days} days`}
                      </option>
                    ))}
                </Select>
              </label>
            </div>
          </Card>
          <div className="settings-actions-bar">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving privacy controls…" : "Save privacy controls"}
            </Button>
            {error ? (
              <p role="alert" className="field-error" style={{ margin: 0 }}>
                {error}
              </p>
            ) : null}
            {message ? (
              <p role="status" style={{ margin: 0 }}>
                {message}
              </p>
            ) : null}
          </div>
        </>
      );

  return wrapCanvas ? <div className="settings-canvas">{content}</div> : content;
}

function CareerPreferencesNoticeCard() {
  return (
    <Card className="stack settings-card">
      <h2 style={{ margin: 0 }}>Career preferences</h2>
      <p className="muted" style={{ margin: 0 }}>
        Career preferences (target roles, locations, work modes, and compensation) are centrally managed in your profile so AI recommendations stay synchronized.
      </p>
      <div className="cluster">
        <Link href="/settings/profile#preferences">
          <Button variant="secondary">Manage in Profile</Button>
        </Link>
      </div>
    </Card>
  );
}

export function PreferenceSettings() {
  return (
    <Frame
      title="Preferences"
      description="Job search filters and notifications."
    >
      <div className="settings-canvas">
        <CareerPreferencesNoticeCard />
        <StoredSettings kind="notifications" wrapCanvas={false} />
      </div>
    </Frame>
  );
}

export function PrivacySettings() {
  return (
    <Frame
      title="Privacy"
      description="Who can see your profile, and whether practice can use the camera and microphone."
    >
      <StoredSettings kind="privacy" />
    </Frame>
  );
}
