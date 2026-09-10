import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/ui/brand-mark";
import {
  SIGN_IN_LIGHT_BEND_DURATION_MS,
  SIGN_IN_LIGHT_BEND_EVENT,
  consumeSignInLightBend,
  peekSignInLightBend,
  readReducedMotionPreference,
} from "@/features/auth/signin-light-bend";
import { motionTokens } from "@/components/ui/motion-system";

const EXIT_MS = Math.round(motionTokens.duration.fast * 1000);

export function SignInLightBend() {
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  const playingRef = useRef(false);
  const finishTimer = useRef(0);
  const exitTimer = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismiss = (immediate = false) => {
      window.clearTimeout(finishTimer.current);
      window.clearTimeout(exitTimer.current);
      playingRef.current = false;
      consumeSignInLightBend();
      if (immediate || readReducedMotionPreference()) {
        setExiting(false);
        setActive(false);
        return;
      }
      setExiting(true);
      exitTimer.current = window.setTimeout(() => {
        setExiting(false);
        setActive(false);
      }, EXIT_MS);
    };

    const start = () => {
      if (readReducedMotionPreference()) {
        consumeSignInLightBend();
        return;
      }
      playingRef.current = true;
      setExiting(false);
      setActive(true);
      window.clearTimeout(finishTimer.current);
      finishTimer.current = window.setTimeout(() => {
        dismiss();
      }, SIGN_IN_LIGHT_BEND_DURATION_MS);
    };

    if (peekSignInLightBend()) start();
    const onArm = () => start();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss(true);
    };
    window.addEventListener(SIGN_IN_LIGHT_BEND_EVENT, onArm);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SIGN_IN_LIGHT_BEND_EVENT, onArm);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(finishTimer.current);
      window.clearTimeout(exitTimer.current);
      playingRef.current = false;
      setExiting(false);
      setActive(false);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const previousActive = document.activeElement;
    document.body.style.overflow = "hidden";
    root?.setAttribute("inert", "");
    if (previousActive instanceof HTMLElement) previousActive.blur();
    return () => {
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute("inert");
    };
  }, [active]);

  if (typeof document === "undefined" || !active) return null;

  return createPortal(
    <div
      className={`signin-light-bend${exiting ? " is-exiting" : ""}`}
      data-testid="signin-light-bend"
      role="status"
      aria-live="polite"
      aria-label="Entering your workspace"
    >
      <div className="signin-light-bend__veil" />
      <div className="signin-light-bend__warp" aria-hidden="true" />
      <div className="signin-light-bend__spectrum" aria-hidden="true">
        <span className="signin-light-bend__chroma is-r" />
        <span className="signin-light-bend__chroma is-g" />
        <span className="signin-light-bend__chroma is-b" />
      </div>
      <div className="signin-light-bend__caustics" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="signin-light-bend__crease" aria-hidden="true" />
      <div className="signin-light-bend__iris" aria-hidden="true" />
      <div className="signin-light-bend__mark">
        <span className="signin-light-bend__glass">
          <BrandMark compact />
        </span>
        <p>Opening workspace</p>
      </div>
    </div>,
    document.body,
  );
}
