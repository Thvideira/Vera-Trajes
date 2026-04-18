/**
 * Remove todas as locações (cascata: retiradas, trajes locados, ajustes, pagamentos,
 * notificações, histórico da locação). Devolve todos os trajes para DISPONIVEL.
 *
 * Uso (irreversível):
 *   CONFIRM_RESET=SIM npm run reset:locacoes
 *
 * Opcional — apagar também movimentações (histórico de saída/devolução no estoque):
 *   CONFIRM_RESET=SIM RESET_MOVIMENTACOES=SIM npm run reset:locacoes
 */
import "dotenv/config";
import { PrismaClient, TrajeStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_RESET !== "SIM") {
    console.error(
      "Abortado: defina CONFIRM_RESET=SIM para confirmar (operação irreversível)."
    );
    process.exit(1);
  }

  const delMov = process.env.RESET_MOVIMENTACOES === "SIM";

  const deletedLoc = await prisma.locacao.deleteMany({});
  console.log(`Locações removidas: ${deletedLoc.count}`);

  const updatedTrajes = await prisma.traje.updateMany({
    data: { status: TrajeStatus.DISPONIVEL },
  });
  console.log(`Trajes marcados como DISPONIVEL: ${updatedTrajes.count}`);

  if (delMov) {
    const deletedMov = await prisma.movimentacao.deleteMany({});
    console.log(`Movimentações removidas: ${deletedMov.count}`);
  } else {
    console.log(
      "Movimentações: mantidas (locacaoId ficará null onde aplicável). Para apagar todas: RESET_MOVIMENTACOES=SIM"
    );
  }

  console.log("Reset operacional concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
