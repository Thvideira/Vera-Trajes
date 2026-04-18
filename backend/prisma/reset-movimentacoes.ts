/**
 * Remove todos os registros da tabela `movimentacoes` (saída por aluguel / entrada por devolução).
 * Não altera locações, trajes nem estoque — apenas o histórico exibido em Movimentações.
 *
 * Uso (irreversível):
 *   CONFIRM_RESET=SIM npm run reset:movimentacoes
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_RESET !== "SIM") {
    console.error(
      "Abortado: defina CONFIRM_RESET=SIM para confirmar (operação irreversível)."
    );
    process.exit(1);
  }

  const r = await prisma.movimentacao.deleteMany({});
  console.log(`Movimentações removidas: ${r.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
