import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CareerJourney } from "../sections/career-journey";

describe("CareerJourney (FE-005)", () => {
  it("renders stage cards with stable data attributes and classes (not motion.div selectors)", () => {
    const { container } = render(
      <MemoryRouter>
        <CareerJourney />
      </MemoryRouter>,
    );
    const cards = container.querySelectorAll("[data-journey-card]");
    expect(cards.length).toBe(6);
    cards.forEach((card) => {
      expect(card.classList.contains("journey-stage-card")).toBe(true);
    });
    const rows = container.querySelectorAll(".journey-stage-row[data-side]");
    expect(rows.length).toBe(6);
    expect(container.querySelector(".journey-progress-line")).toBeTruthy();
  });
});
