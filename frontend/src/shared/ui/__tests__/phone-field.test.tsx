import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  PhoneField,
  composePhone,
  matchesSearch,
  parsePhone,
  type PhoneValue,
} from "../phone-field";
import { COUNTRIES } from "../countries";

function Harness() {
  const [value, setValue] = useState<PhoneValue>({ iso2: "IN", national: "" });
  return (
    <PhoneField
      label="Mobile number"
      value={value}
      onChange={(next) => {
        setValue(next);
      }}
    />
  );
}

describe("country search", () => {
  it("matches by country name, iso2, and dial code", () => {
    expect(matchesSearch({ iso2: "IN", name: "India", dial: "+91" }, "india")).toBe(true);
    expect(matchesSearch({ iso2: "IN", name: "India", dial: "+91" }, "IN")).toBe(true);
    expect(matchesSearch({ iso2: "IN", name: "India", dial: "+91" }, "91")).toBe(true);
    expect(matchesSearch({ iso2: "IN", name: "India", dial: "+91" }, "+91")).toBe(true);
    expect(matchesSearch({ iso2: "DE", name: "Germany", dial: "+49" }, "germ")).toBe(true);
    expect(matchesSearch({ iso2: "DE", name: "Germany", dial: "+49" }, "49")).toBe(true);
    expect(matchesSearch({ iso2: "DE", name: "Germany", dial: "+49" }, "japan")).toBe(false);
  });

  it("dataset covers every entry with unique iso2 and valid dial", () => {
    const isoSet = new Set(COUNTRIES.map((c) => c.iso2));
    expect(isoSet.size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.dial).toMatch(/^\+\d{1,4}$/);
    }
    expect(COUNTRIES.length).toBeGreaterThan(190);
  });
});

describe("phone parse/compose", () => {
  it("composes E.164 and parses back by longest dial match", () => {
    expect(composePhone({ iso2: "IN", national: "9876543210" })).toBe("+919876543210");
    const parsed = parsePhone("+14155550100");
    expect(parsed.iso2).toBe("US");
    expect(parsed.national).toBe("4155550100");
    const gb = parsePhone("+447700900123");
    expect(gb.iso2).toBe("GB");
    const inr = parsePhone("+919876543210");
    expect(inr.iso2).toBe("IN");
    expect(parsePhone("")).toEqual({ iso2: "IN", national: "" });
  });
});

describe("PhoneField interactions", () => {
  it("searches, selects a country, and composes the number", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /country code: india/i }));
    const search = screen.getByLabelText(/search country or code/i);
    fireEvent.change(search, { target: { value: "germ" } });
    const option = screen.getByRole("option", { name: /Germany/ });
    fireEvent.click(option);
    const input = screen.getByLabelText(/mobile number/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15123456789" } });
    expect(screen.getByText(/Will be saved as \+4915123456789/)).toBeTruthy();
  });

  it("strips non-digits from the national number", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /country code: india/i }));
    fireEvent.change(screen.getByLabelText(/search country or code/i), { target: { value: "+91" } });
    fireEvent.click(screen.getByRole("option", { name: /India/ }));
    const input = screen.getByLabelText(/mobile number/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "98a76b543210" } });
    expect(input.value).toBe("9876543210");
  });
});
