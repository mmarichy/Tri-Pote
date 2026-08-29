import { Redis } from "@upstash/redis";
import type { RoomState } from "../../shared/types";

const memory = new Map<string, RoomState>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedis();
const TTL_SECONDS = 60 * 60 * 4;

export async function getRoom(code: string): Promise<RoomState | null> {
  const key = `room:${code}`;
  if (redis) {
    return redis.get<RoomState>(key);
  }
  return memory.get(code) ?? null;
}

export async function saveRoom(room: RoomState): Promise<void> {
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
