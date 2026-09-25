/**
 * Robust clipboard copy utility.
 * Attempts modern navigator.clipboard.writeText first;
 * falls back to document.execCommand('copy') in non-HTTPS / restricted contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !text) return false;

  // 1. Try modern Async Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  // 2. Legacy execCommand fallback for non-secure HTTP / sandboxed iframes
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "-9999px";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.setAttribute("readonly", "");
    textArea.setAttribute("aria-hidden", "true");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return Boolean(successful);
  } catch {
    return false;
  }
}
