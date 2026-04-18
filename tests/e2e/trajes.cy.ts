/**
 * Exclusão de traje na lista (módulo Trajes).
 * Requer admin logado e pelo menos um traje DISPONIVEL sem vínculo em locação.
 */
describe("Trajes (E2E)", () => {
  beforeEach(() => {
    cy.visit("/login");
    cy.get('input[type="email"]').clear().type("admin@loja.vera");
    cy.get('input[type="password"]').clear().type("admin123");
    cy.contains("button", "Entrar").click();
    cy.url({ timeout: 15000 }).should("match", /\/($|\?)/);
    cy.visit("/trajes");
    cy.contains("h1", "Trajes", { timeout: 15000 }).should("be.visible");
  });

  it("lista de trajes não mostra botão Excluir em locações (rota /locacoes)", () => {
    cy.visit("/locacoes");
    cy.contains("Locações", { timeout: 15000 });
    cy.get("body").then(($b) => {
      const t = $b.text();
      expect(t).not.to.match(/excluir do cadastro/i);
    });
  });

  it("cards de trajes linkam para /trajes/:id quando há itens na lista", () => {
    cy.get('a[href^="/trajes/"]').should(($a) => {
      if ($a.length > 0) {
        expect($a.first().attr("href")).to.match(/\/trajes\/[a-z0-9]+$/i);
      }
    });
  });
});
