import { z } from 'zod';

/**
 * Раскладка скипа времени по одному долгу — для честной визуализации урока
 * на экране межсезонья ("20 000 под 14% стали 33 700").
 */
export const debtProjectionSchema = z.object({
  before: z.number(),
  rate: z.number(),
  after: z.number(),
  /** Значение долга на конец каждого года: длина массива == years. */
  perYear: z.array(z.number()),
});
export type DebtProjection = z.infer<typeof debtProjectionSchema>;

/** Раскладка по накоплениям (money>0) аналогично долгам. */
export const savingsProjectionSchema = z.object({
  before: z.number(),
  rate: z.number(),
  after: z.number(),
  perYear: z.array(z.number()),
});
export type SavingsProjection = z.infer<typeof savingsProjectionSchema>;

export const timeSkipSchema = z.object({
  years: z.number().int().nonnegative(),
  savings: savingsProjectionSchema.nullable(),
  debts: z.array(debtProjectionSchema),
});
export type TimeSkip = z.infer<typeof timeSkipSchema>;
