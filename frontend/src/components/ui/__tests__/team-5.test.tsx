import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Team5 } from "../team-5";

describe("Team5", () => {
  it("renders the heading and default team portraits", () => {
    render(
      <Team5
        heading="The team"
        description="The builders behind Career Copilot."
      />,
    );
    expect(screen.getByRole("heading", { name: "The team" })).toBeTruthy();
    expect(screen.getByText("Daji Adelkar")).toBeTruthy();
    expect(screen.getByText("Ronak K.")).toBeTruthy();
    expect(screen.getByText("Pratik Bamhane")).toBeTruthy();
    expect(screen.getByText("Mohammad Faizan Khan")).toBeTruthy();
    expect(screen.getByText("Priyansu Pattanaik")).toBeTruthy();
    expect(screen.getByAltText("Portrait of Daji Adelkar")).toBeTruthy();
  });

  it("does not invent extra people when members are supplied", () => {
    render(
      <Team5
        heading="The team"
        members={[
          {
            id: "only-ada",
            name: "Ada Lovelace",
            image: "https://example.com/ada.jpg",
          },
        ]}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Daji Adelkar")).toBeNull();
  });
});
