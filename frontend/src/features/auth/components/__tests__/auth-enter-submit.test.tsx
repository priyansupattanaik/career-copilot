import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/shared/theme";
import { SignInScreen, SignUpScreen } from "../auth-screen";

const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock("@/features/auth/api/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signUp,
      resend: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  }),
}));

function renderAuth(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
}

function pressEnter(element: HTMLElement) {
  fireEvent.keyDown(element, { key: "Enter", code: "Enter", bubbles: true });
}

beforeEach(() => {
  signInWithPassword.mockReset();
  signUp.mockReset();
  signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "tok" }, user: { id: "u1" } },
    error: null,
  });
  signUp.mockResolvedValue({
    data: { session: null, user: { id: "u2" } },
    error: null,
    emailConfirmationSent: true,
  });
});

describe("auth Enter submits the form", () => {
  it("signs in when Enter is pressed in the password field", async () => {
    renderAuth(<SignInScreen />);
    fireEvent.change(screen.getByLabelText(/email, phone, or username/i), { target: { value: "a@test.dev" } });
    const password = screen.getByLabelText(/^password$/i);
    fireEvent.change(password, { target: { value: "Passw0rd!" } });
    pressEnter(password);
    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        identifier: "a@test.dev",
        password: "Passw0rd!",
      });
    });
  });

  it("reveals the password only while the animated control is held", () => {
    renderAuth(<SignInScreen />);
    const password = screen.getByLabelText(/^password$/i);
    const toggle = screen.getByTestId("password-visibility-toggle");

    expect(password.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-label")).toBe("Show password");
    fireEvent.pointerDown(toggle);
    expect(password.getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-label")).toBe("Hide password");
    fireEvent.pointerUp(toggle);
    expect(password.getAttribute("type")).toBe("password");
  });

  it("creates an account when Enter is pressed in the confirm-password field", async () => {
    renderAuth(<SignUpScreen />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "alex@test.dev" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "alex_morgan" } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Passw0rd!" } });
    const confirm = screen.getByLabelText(/confirm password/i);
    fireEvent.change(confirm, { target: { value: "Passw0rd!" } });
    pressEnter(confirm);
    await waitFor(() => {
      expect(signUp).toHaveBeenCalled();
    });
    expect(signUp.mock.calls[0][0]).toMatchObject({
      email: "alex@test.dev",
      password: "Passw0rd!",
      options: { phone: "+919876543210" },
    });
  });
});
