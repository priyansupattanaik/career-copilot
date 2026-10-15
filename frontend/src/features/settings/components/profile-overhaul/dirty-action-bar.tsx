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
      <div className="fixed bottom-6 inset-x-0 mx-auto max-w-lg z-40 px-4 animate-in slide-in-from-bottom-5 duration-200">
        <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#111111]/95 border border-neutral-700/80 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 pl-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wide">
              Unsaved changes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowDiscardConfirm(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow"
            >
              {saving ? (
                <>
                  <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <CopilotIcon name="alert" className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-white">
                Discard unsaved changes?
              </h4>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to discard your edits? All unsaved modifications
              will be reverted to your last saved profile state.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onDiscard();
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
