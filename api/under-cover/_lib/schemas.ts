import { z } from "zod";

export const roleSchema = z.enum(["civilian", "undercover", "mrwhite"]);

export const phaseSchema = z.enum([
  "lobby",
  "reveal",
  "speaking",
  "debate",
  "vote",
  "round-end",
  "game-end",
]);

export const winnerSchema = z.enum(["civilians", "undercover", "mrwhite"]);

export const wordPairSchema = z.object({
  id: z.string(),
  civilian: z.string().min(1),
  undercover: z.string().min(1),
});

export const playerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(24),
  isAlive: z.boolean(),
});

export const roomSettingsSchema = z.object({
  includeMrWhite: z.boolean(),
  minPlayers: z.number().int().min(3).max(12),
});

export const eliminationRevealSchema = z.object({
  playerId: z.string().uuid(),
  role: roleSchema,
});

export const roomStateSchema = z.object({
  code: z.string().min(4).max(6),
  hostId: z.string().uuid(),
  players: z.array(playerSchema).min(1).max(12),
  phase: phaseSchema,
  settings: roomSettingsSchema,
  round: z.number().int().min(0),
  wordPair: wordPairSchema.nullable(),
  roles: z.record(z.string().uuid(), roleSchema),
  speakingOrder: z.array(z.string().uuid()),
  currentSpeakerIndex: z.number().int().min(0),
  clues: z.record(z.string().uuid(), z.string()),
  revealAcks: z.record(z.string().uuid(), z.boolean()),
  votes: z.record(z.string().uuid(), z.string().uuid()),
  eliminatedThisRound: z.string().uuid().nullable(),
  lastEliminated: eliminationRevealSchema.nullable(),
  winner: winnerSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type RoomStateParsed = z.infer<typeof roomStateSchema>;

export const REDIS_KEY_PREFIX = "undercover";

export function roomKey(code: string): string {
  return `${REDIS_KEY_PREFIX}:room:${code}`;
}

export function presenceKey(code: string, playerId: string): string {
  return `${REDIS_KEY_PREFIX}:presence:${code}:${playerId}`;
}

export function parseRoomState(data: unknown) {
  return roomStateSchema.safeParse(data);
}
