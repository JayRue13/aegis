// Request validation for /api/chat.

import { z } from "zod";

const image = z.object({
  type: z.literal("image"),
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
    .max(7_000_000),
  name: z.string().max(200).optional(),
});

const file = z.object({
  name: z.string().max(200),
  text: z.string().max(200_000),
});

const message = z.object({
  id: z.string().max(100),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(100_000),
  images: z.array(image).max(4).optional(),
  files: z.array(file).max(10).optional(),
  model: z.string().max(200).optional(),
  createdAt: z.string().max(50),
  error: z.boolean().optional(),
});

export const chatRequestSchema = z.object({
  model: z.string().min(3).max(200),
  messages: z.array(message).min(1).max(400),
  memories: z
    .array(z.object({ id: z.string().max(100), content: z.string().max(1000), createdAt: z.string().max(50) }))
    .max(500)
    .optional(),
  project: z
    .object({ name: z.string().max(200), instructions: z.string().max(20_000) })
    .nullable()
    .optional(),
  userName: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
