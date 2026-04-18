import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteTrajeConfirmModal } from "../../src/components/DeleteTrajeConfirmModal";

describe("DeleteTrajeConfirmModal", () => {
  it("mostra texto de confirmação e botões", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteTrajeConfirmModal
        open
        trajeLabel="vestido01 — Vestido azul"
        busy={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    expect(
      screen.getByText(/TEM CERTEZA QUE DESEJA EXCLUIR ESTE TRAJE/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/vestido01 — Vestido azul/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirmar exclusão/i })
    ).toBeInTheDocument();
  });

  it("Cancelar chama onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <DeleteTrajeConfirmModal
        open
        trajeLabel="x"
        busy={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
