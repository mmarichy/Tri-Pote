import { Redis } from "@upstash/redis";
import type { RoomState } from "./types";

const memory = new Map<string, RoomState>();
const TTL_SECONDS = 60 * 60 * 4;

function getRedis(): Redis | null {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
  } catch {
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
  memory.set(room.code, room);
}

export async function roomExists(code: string): Promise<boolean> {
  const room = await getRoom(code);
  return room !== null;
}
