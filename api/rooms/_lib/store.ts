import { Redis } from "@upstash/redis";
import type { RoomState } from "./types.js";

const memory = new Map<string, RoomState>();
const TTL_SECONDS = 60 * 60 * 4;

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

export async function roomExists(code: string): Promise<boolean> {
  const room = await getRoom(code);
  return room !== null;
}
