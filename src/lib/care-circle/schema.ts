import { z } from "zod";
export const taskSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(180),
    kind: z.enum(["study", "supplies", "medication", "task"]),
    owner: z.enum(["vale", "guille", "helper"]),
    payer: z.enum(["vale", "guille", "helper"]),
    budget: z.number().min(0).max(1000000).nullable(),
    due: z.string().max(120),
    clinical: z.boolean(),
    evidence: z.string().max(4000),
    inference: z.string().max(4000),
    approval: z.enum(["pending", "approved"]),
    completed: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/),
    started: z.boolean().optional(),
    recurring: z.boolean().optional(),
  })
  .strict();
export const receiptSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(180),
    amount: z.number().nonnegative().max(1000000),
    currency: z.enum(["MXN", "SGD", "USD"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reference: z.string().max(250),
    source: z.literal("manual"),
  })
  .strict();
export const circleStateSchema = z
  .object({
    person: z.string().trim().min(1).max(80),
    tasks: z.array(taskSchema).max(200),
    receipts: z.array(receiptSchema).max(200),
  })
  .strict();
export type CircleState = z.infer<typeof circleStateSchema>;
