import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PopupProvider, confirmAsync, showPopup } from "../../src/contexts/PopupContext";

describe("Popup global", () => {
  it("showPopup exibe título, mensagem e botão OK", async () => {
    const user = userEvent.setup();
    render(
      <PopupProvider>
        <button
          type="button"
          onClick={() =>
            showPopup({
              type: "info",
              title: "Título teste",
              message: "Mensagem de teste",
              confirmText: "Fechar",
            })
          }
        >
          Abrir
        </button>
      </PopupProvider>
    );
    await user.click(screen.getByRole("button", { name: /abrir/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Título teste")).toBeInTheDocument();
    expect(screen.getByText("Mensagem de teste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fechar/i })).toBeInTheDocument();
  });

  it("confirmAsync exibe Cancelar e Confirmar", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <PopupProvider>
        <button
          type="button"
          onClick={async () => {
            const r = await confirmAsync({
              type: "warning",
              title: "Confirma?",
              message: "Ação irreversível.",
              confirmText: "Sim",
              cancelText: "Não",
            });
            onResult(r);
          }}
        >
          Perguntar
        </button>
      </PopupProvider>
    );
    await user.click(screen.getByRole("button", { name: /perguntar/i }));
    expect(screen.getByRole("button", { name: /^não$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sim$/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^sim$/i }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true), {
      timeout: 600,
    });
  });
});
