/**
 * Requer: API em :4000, Vite em :5173, banco com seed (admin@loja.vera / admin123).
 */
describe("Autenticação (E2E)", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("fluxo de erro: senha incorreta exibe mensagem", () => {
    cy.get('input[type="email"]').clear().type("admin@loja.vera");
    cy.get('input[type="password"]').clear().type("senha-errada-xyz");
    cy.contains("button", "Entrar").click();
    cy.contains(/credenciais|falha|inválid/i, { timeout: 15000 }).should(
      "be.visible"
    );
  });

  it("login admin redireciona para o dashboard", () => {
    cy.get('input[type="email"]').clear().type("admin@loja.vera");
    cy.get('input[type="password"]').clear().type("admin123");
    cy.contains("button", "Entrar").click();
    cy.url({ timeout: 15000 }).should("match", /\/($|\?)/);
  });
});
