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
        className="fixed inset-x-0 mx-auto max-w-lg z-40 px-4"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          style={{
            backgroundColor: "var(--surface-3)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "var(--accent)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink)",
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
              className="wb-button wb-button-ghost"
              style={{ height: 36 }}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="wb-button wb-button-primary"
              style={{ height: 36 }}
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
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 384,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
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
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
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
                color: "var(--ink-2)",
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
                paddingTop: 8,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="wb-button wb-button-ghost"
                style={{ height: 36 }}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onDiscard();
                }}
                className="wb-button"
                style={{
                  height: 36,
                  backgroundColor: "var(--danger)",
                  color: "#000000",
                  fontWeight: 600,
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
