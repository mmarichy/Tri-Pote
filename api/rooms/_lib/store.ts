import { Redis } from "@upstash/redis";
import type { RoomState } from "./types.js";

const memory = new Map<string, RoomState>();
const memoryPresence = new Map<string, number>();
const TTL_SECONDS = 60 * 60 * 4;
const PRESENCE_TTL_SECONDS = 60 * 10;

function getRedis(): Redis | null {
  try {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (upstashUrl && upstashToken) {
      return new Redis({ url: upstashUrl, token: upstashToken });
    }

    const kvUrl = process.env.KV_REST_API_URL?.trim();
    const kvToken = process.env.KV_REST_API_TOKEN?.trim();
    if (kvUrl && kvToken) {
      return new Redis({ url: kvUrl, token: kvToken });
    }

    return null;
  } catch (err) {
    console.error("Redis init failed:", err);
    return null;
  }
}

export async function getRoom(code: string): Promise<RoomState | null> {
  const redis = getRedis();
  const key = `room:${code}`;
  if (redis) {
    return redis.get<RoomState>(key);
  }
  return memory.get(code) ?? null;
}

export async function saveRoom(room: RoomState): Promise<void> {
  const redis = getRedis();
  const key = `room:${room.code}`;
  if (redis) {
    await redis.set(key, room, { ex: TTL_SECONDS });
    return;
  }
  console.warn("Redis non configuré — stockage mémoire local (dev uniquement)");
  memory.set(room.code, room);
}

export async function deleteRoom(code: string): Promise<void> {
  const redis = getRedis();
  const key = `room:${code}`;
  if (redis) {
    await redis.del(key);
    return;
  }
  memory.delete(code);
}

export async function roomExists(code: string): Promise<boolean> {
  const room = await getRoom(code);
  return room !== null;
}

/*
 * La présence est stockée dans des clés séparées (une par joueur) plutôt que
 * dans l'objet salon : les sondages fréquents ne réécrivent ainsi jamais
 * l'état du salon, ce qui évitait d'écraser un départ concurrent.
 */
function presenceKey(code: string, playerId: string): string {
  return `presence:${code}:${playerId}`;
}

export async function touchPresence(
  code: string,
  playerId: string
): Promise<void> {
  const redis = getRedis();
  const key = presenceKey(code, playerId);
  if (redis) {
    await redis.set(key, Date.now(), { ex: PRESENCE_TTL_SECONDS });
    return;
  }
  memoryPresence.set(key, Date.now());
}

/* Pose une "pierre tombale" : le joueur a quitté volontairement (ou a été
 * expulsé), toute résurrection par une écriture concurrente sera re-purgée. */
export async function markLeft(
  code: string,
  playerId: string
): Promise<void> {
  const redis = getRedis();
  const key = presenceKey(code, playerId);
  if (redis) {
    await redis.set(key, 0, { ex: PRESENCE_TTL_SECONDS });
    return;
  }
  memoryPresence.set(key, 0);
}

export async function getPresenceMap(
  code: string,
  playerIds: string[]
): Promise<Record<string, number | undefined>> {
  const result: Record<string, number | undefined> = {};
  if (playerIds.length === 0) return result;

  const redis = getRedis();
  if (redis) {
    const values = await redis.mget<(number | null)[]>(
      ...playerIds.map((id) => presenceKey(code, id))
    );
    playerIds.forEach((id, i) => {
      const value = values[i];
      result[id] = typeof value === "number" ? value : undefined;
    });
    return result;
  }

  for (const id of playerIds) {
    result[id] = memoryPresence.get(presenceKey(code, id));
  }
  return result;
}
