import type { Decimal } from "@prisma/client/runtime/library";
import { PagamentoLocacaoStatus, Prisma } from "@prisma/client";

export function computeRemaining(
  valorTotal: Decimal | Prisma.Decimal,
  valorPago: Decimal | Prisma.Decimal
): Prisma.Decimal {
  const t = new Prisma.Decimal(valorTotal.toString());
  const p = new Prisma.Decimal(valorPago.toString());
  return t.minus(p);
}

export function derivePaymentStatus(
  valorTotal: Decimal | Prisma.Decimal,
  valorPago: Decimal | Prisma.Decimal
): PagamentoLocacaoStatus {
  const rem = computeRemaining(valorTotal, valorPago);
  if (rem.lte(0)) return PagamentoLocacaoStatus.PAGO;
  const p = new Prisma.Decimal(valorPago.toString());
  if (p.gt(0)) return PagamentoLocacaoStatus.PARCIAL;
  return PagamentoLocacaoStatus.PENDENTE;
}
