import { z } from "zod";

export const BlockSchema = z.object({
  key: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export const GenerateResultSchema = z.object({
  blocks: z.array(BlockSchema),
  warnings: z.array(z.string()).default([]),
});

export type GenerateResult = z.infer<typeof GenerateResultSchema>;