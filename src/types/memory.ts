import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.number().finite().nonnegative();
export const memoryTurnSchema = z.object({
  id: uuid,
  sequence: z.number().int().nonnegative(),
  speaker: z.enum(["sam", "other"]),
  modality: z.enum(["typed", "signed", "speech"]),
  text: z.string().trim().min(1).max(4000),
  gloss: z.string().max(4000).optional(),
  timestamp,
});
export const conversationSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(120),
  context: z.string().max(200),
  startedAt: timestamp,
  endedAt: timestamp,
  recallAllowed: z.boolean(),
  turns: z.array(memoryTurnSchema).min(1).max(1000),
  corrections: z
    .array(
      z.object({
        heard: z.string().max(200),
        meant: z.string().max(200),
      }),
    )
    .max(1000),
});
export type SavedConversation = z.infer<typeof conversationSchema>;
export const memorySummarySchema = conversationSchema
  .omit({ turns: true, corrections: true })
  .extend({
    preview: z.string().max(200),
    turnCount: z.number().int().positive(),
  });
export const memoryHitSchema = z.object({
  conversationId: uuid,
  turnId: uuid,
  title: z.string(),
  speaker: z.enum(["sam", "other"]),
  timestamp,
  text: z.string().max(500),
});
export const memoryDataSchema = z.object({
  generation: z.number().int().nonnegative(),
  recallEnabled: z.boolean(),
  conversations: z.array(memorySummarySchema).max(20),
  conversation: conversationSchema.nullable(),
  hits: z.array(memoryHitSchema).max(5),
  hasMore: z.boolean(),
});
export type MemoryData = z.infer<typeof memoryDataSchema>;
export type MemoryHit = z.infer<typeof memoryHitSchema>;
export type MemorySummary = z.infer<typeof memorySummarySchema>;
export type MemoryAction =
  | { action: "state" | "erase" }
  | { action: "save"; conversation: SavedConversation }
  | { action: "list"; offset: number }
  | { action: "detail" | "delete"; conversationId: string }
  | { action: "setGlobalRecall"; enabled: boolean }
  | { action: "setRecall"; conversationId: string; enabled: boolean }
  | { action: "search"; query: string; excludingConversationId: string };
export type MemoryRequest = MemoryAction & {
  type: "memory";
  version: 1;
  requestId: string;
  expectedGeneration?: number;
};
export const memoryResponseSchema = z.discriminatedUnion("ok", [
  z.object({ version: z.literal(1), requestId: uuid, ok: z.literal(true), data: memoryDataSchema }),
  z.object({
    version: z.literal(1),
    requestId: uuid,
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
