import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../src/pages/LoginPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../src/lib/api", () => ({
  apiSend: vi.fn(),
}));

import { apiSend } from "../../src/lib/api";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza campos de login e botão Entrar", () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /entrar/i })
    ).toBeInTheDocument();
  });

  it("chama login com credenciais e redireciona admin para /", async () => {
    const user = userEvent.setup();
    vi.mocked(apiSend).mockResolvedValue({
      token: "fake.jwt.token",
      user: {
        id: "1",
        email: "admin@loja.vera",
        nome: "Admin",
        role: "ADMIN" as const,
      },
    });

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const email = container.querySelector(
      'input[type="email"]'
    ) as HTMLInputElement;
    const password = container.querySelector(
      'input[type="password"]'
    ) as HTMLInputElement;
    await user.clear(email);
    await user.type(email, "admin@loja.vera");
    await user.clear(password);
    await user.type(password, "admin123");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(apiSend).toHaveBeenCalledWith("/api/auth/login", "POST", {
      email: "admin@loja.vera",
      password: "admin123",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
