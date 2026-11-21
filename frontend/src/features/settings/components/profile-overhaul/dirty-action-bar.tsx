import { useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";

interface DirtyActionBarProps {
  isDirty: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  saving?: boolean;
}

export function DirtyActionBar({
  isDirty,
  onSave,
  onDiscard,
  saving = false,
}: DirtyActionBarProps) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (!isDirty) return null;

  return (
    <>
      <div
        className="profile-dirty-action-bar fixed inset-x-0 mx-auto max-w-lg z-50 px-4"
        style={{ bottom: "var(--dirty-bar-bottom, calc(1.5rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <div
          className="profile-dirty-action-bar-inner"
          style={{
            backgroundColor: "color-mix(in srgb, var(--ps-panel, var(--surface)) 94%, var(--ps-paper, var(--background)))",
            border: "1px solid var(--ps-line, var(--border))",
            borderRadius: "var(--ps-radius, 16px)",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 12px 32px rgb(0 0 0 / 22%), 0 4px 12px rgb(0 0 0 / 12%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "var(--ps-accent, var(--accent))",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 650,
                color: "var(--ps-text, var(--text))",
              }}
            >
              Unsaved changes
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowDiscardConfirm(true)}
              className="button button-secondary"
              style={{ minHeight: 36, height: 36, padding: "0 14px", fontSize: 13 }}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="button button-primary"
              style={{ minHeight: 36, height: 36, padding: "0 16px", fontSize: 13 }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 384,
              borderRadius: "var(--ps-radius-lg, 20px)",
              backgroundColor: "var(--ps-panel, var(--surface))",
              border: "1px solid var(--ps-line, var(--border))",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 16px 40px rgb(0 0 0 / 28%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "var(--warn-soft)",
                  border: "1px solid var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--warn)",
                  flexShrink: 0,
                }}
              >
                <CopilotIcon name="alert" size={16} />
              </div>
              <h4
                id="discard-dialog-title"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  fontWeight: 650,
                  color: "var(--ps-text, var(--text))",
                  margin: 0,
                }}
              >
                Discard changes?
              </h4>
            </div>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                lineHeight: "20px",
                color: "var(--ps-muted, var(--muted))",
                margin: 0,
              }}
            >
              Are you sure you want to discard your edits? All unsaved modifications
              will be reverted to your last saved profile state.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid var(--ps-line, var(--border))",
              }}
            >
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="button button-secondary"
                style={{ minHeight: 36, height: 36, padding: "0 14px", fontSize: 13 }}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onDiscard();
                }}
                className="button button-destructive"
                style={{
                  minHeight: 36,
                  height: 36,
                  padding: "0 16px",
                  fontSize: 13,
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
