import {
  AjusteStatus,
  AjusteTipo,
  LavagemStatus,
  TipoPagamentoRegistro,
  TrajeTipo,
} from "@prisma/client";
import { z } from "zod";
import { normalizarTelefoneParaBanco } from "../utils/telefone.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

/** CPF: aceita com ou sem máscara; resultado do parse são 11 dígitos. */
const cpf11 = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().length(11, "CPF deve ter 11 dígitos"));

/** Telefone BR: só dígitos, DDD + número (10 ou 11); aceita entrada com 55. */
const telefoneBr = z
  .string()
  .transform((s) => normalizarTelefoneParaBanco(s))
  .pipe(
    z.string().refine(
      (d) => d.length === 10 || d.length === 11,
      "Telefone deve ter 10 ou 11 dígitos (DDD + número)"
    )
  );

export const clienteCreateSchema = z.object({
  nome: z.string().min(2),
  telefone: telefoneBr,
  cpf: cpf11,
  cep: z.string().min(8),
  logradouro: z.string().min(1),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
});

export const clienteUpdateSchema = clienteCreateSchema.partial();

export const trajeCreateSchema = z.object({
  nome: z.string().min(1),
  tipo: z.nativeEnum(TrajeTipo),
  codigo: z.string().min(1),
  tamanho: z.string().min(1),
});

export const trajeUpdateSchema = trajeCreateSchema.partial();

const ajusteLinha = z.object({
  tipo: z.nativeEnum(AjusteTipo),
  descricao: z.string().optional(),
});

/** Entrada flexível: retiradas vazias/incompletas são descartadas no service */
export const retiradaCreateLinha = z.object({
  dataRetirada: z.union([z.string(), z.coerce.date()]).optional(),
  trajes: z
    .array(
      z.object({
        trajeId: z.string().optional(),
        precisaLavagem: z.boolean().optional(),
        ajustes: z.array(ajusteLinha).optional(),
      })
    )
    .optional(),
});

/** Nova retirada em locação existente — dados obrigatórios */
export const retiradaAddSchema = z.object({
  dataRetirada: z.coerce.date(),
  trajes: z
    .array(
      z.object({
        trajeId: z.string().min(1),
        precisaLavagem: z.boolean().optional(),
        ajustes: z.array(ajusteLinha).optional(),
      })
    )
    .min(1),
});

export const locacaoCreateSchema = z.object({
  clienteId: z.string().min(1),
  observacoes: z.string().optional().nullable(),
  /** Obrigatório: referência para intervalo mínimo entre locações do mesmo traje. */
  dataEvento: z.coerce.date(),
  dataDevolucaoPrevista: z.coerce.date().optional().nullable(),
  valorTotal: z.coerce.number().positive(),
  valorPagoInicial: z.coerce.number().nonnegative().optional(),
  retiradas: z.array(retiradaCreateLinha).default([]),
});

export const locacaoPatchSchema = z.object({
  observacoes: z.string().optional().nullable(),
  dataEvento: z.coerce.date().optional().nullable(),
  dataDevolucaoPrevista: z.coerce.date().optional().nullable(),
});

export const validarIntervaloTrajesSchema = z.object({
  dataInicio: z.coerce.date(),
  trajeIds: z.array(z.string().min(1)).min(1),
  excludeLocacaoId: z.string().min(1).optional(),
});

export const retiradaPatchSchema = z.object({
  dataRetirada: z.coerce.date().optional(),
});

export const addTrajeLocadoBodySchema = z.object({
  trajeId: z.string().min(1),
  precisaLavagem: z.boolean().optional(),
  ajustes: z.array(ajusteLinha).optional(),
});

export const trajeLocadoPatchSchema = z.object({
  precisaLavagem: z.boolean().optional(),
  lavagemStatus: z.nativeEnum(LavagemStatus).optional(),
});

export const pagamentoSchema = z.object({
  valor: z.coerce.number().positive(),
  tipo: z.nativeEnum(TipoPagamentoRegistro),
});

/** Registro financeiro simplificado (valor desta quitação, sem tipo explícito). */
export const registrarPagamentoValorSchema = z.object({
  valor_pago: z.coerce.number().positive(),
});

export const ajusteCreateSchema = z.object({
  tipo: z.nativeEnum(AjusteTipo),
  descricao: z.string().optional(),
});

export const ajusteStatusSchema = z.object({
  status: z.nativeEnum(AjusteStatus),
});

const ymdOptional = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
);

export const listLocacaoQuerySchema = z.object({
  encerrada: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  /** Dia civil (YYYY-MM-DD): locações com `dataEvento` nesse dia (campo evento da locação) */
  dataEvento: ymdOptional,
});

export const relatorioQuerySchema = z.object({
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
});

export const listTrajeQuerySchema = z.object({
  q: z.string().optional(),
  tipo: z.nativeEnum(TrajeTipo).optional(),
  status: z.enum(["DISPONIVEL", "ALUGADO"]).optional(),
});
