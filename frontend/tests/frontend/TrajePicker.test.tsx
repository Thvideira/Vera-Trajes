import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrajePicker } from "../../src/pages/LocacoesPage";

vi.mock("../../src/lib/api", () => ({
  apiGet: vi.fn(),
  apiSend: vi.fn(),
}));

vi.mock("../../src/lib/trajesCatalog", () => ({
  subscribeTrajeCatalogLive: () => () => {},
}));

import { apiGet } from "../../src/lib/api";

describe("TrajePicker (Locações)", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockResolvedValue([
      {
        id: "t1",
        nome: "Vestido A",
        tipo: "VESTIDO",
        codigo: "v01",
        tamanho: "M",
        status: "DISPONIVEL" as const,
      },
    ]);
  });

  it("não exibe botão Excluir (exclusão fica só no módulo Trajes)", async () => {
    const onChange = vi.fn();
    render(<TrajePicker value="" onChange={onChange} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /^excluir$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /excluir do cadastro/i })
    ).not.toBeInTheDocument();
  });
});
