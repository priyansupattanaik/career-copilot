import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ArrowRight, Check, Search, LoaderCircle } from "lucide-react";
import { AnimateIcon, AnimatedIcon } from "../animated-icon";

describe("AnimateIcon / AnimatedIcon", () => {
  it("renders Lucide icon via icon prop", () => {
    const { container } = render(
      <AnimatedIcon icon={ArrowRight} size={20} className="custom-icon" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(container.querySelector(".animate-ui-icon")).toBeTruthy();
    expect(container.querySelector(".custom-icon")).toBeTruthy();
  });

  it("renders Lucide icon as children", () => {
    const { container } = render(
      <AnimateIcon animation="pointing">
        <ArrowRight size={18} />
      </AnimateIcon>,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("handles mouse hover and unhover events gracefully", () => {
    const { container } = render(<AnimatedIcon icon={Search} size={16} />);
    const iconRoot = container.querySelector(".animate-ui-icon") as HTMLElement;
    expect(iconRoot).toBeTruthy();
    fireEvent.mouseEnter(iconRoot);
    fireEvent.mouseLeave(iconRoot);
  });

  it("handles pointer down and up events for tap interaction", () => {
    const { container } = render(<AnimatedIcon icon={Check} size={16} />);
    const iconRoot = container.querySelector(".animate-ui-icon") as HTMLElement;
    expect(iconRoot).toBeTruthy();
    fireEvent.pointerDown(iconRoot);
    fireEvent.pointerUp(iconRoot);
  });

  it("supports spinner variant for loaders", () => {
    const { container } = render(
      <AnimatedIcon icon={LoaderCircle} className="spin" size={16} />,
    );
    const iconRoot = container.querySelector(".animate-ui-icon") as HTMLElement;
    expect(iconRoot.classList.contains("spin")).toBe(true);
  });

  it("handles parent button hover events to trigger icon animation", () => {
    const { container } = render(
      <button type="button" className="btn">
        <span>Click me</span>
        <AnimatedIcon icon={ArrowRight} size={16} />
      </button>,
    );
    const btn = container.querySelector("button") as HTMLElement;
    const icon = container.querySelector(".animate-ui-icon") as HTMLElement;
    expect(btn).toBeTruthy();
    expect(icon).toBeTruthy();
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
  });

  it("renders standalone exported animated icons", () => {
    const { container } = render(<AnimatedIcon icon={Check} size={16} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
