import { ROOM_CODE_MAX, ROOM_CODE_MIN } from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeRoomCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  const normalized = normalizeRoomCode(code);
  return (
    normalized.length >= ROOM_CODE_MIN &&
    normalized.length <= ROOM_CODE_MAX &&
    /^[A-Z0-9]+$/.test(normalized)
  );
}

export function generateRoomCode(length = 5): string {
  const size = Math.min(
    ROOM_CODE_MAX,
    Math.max(ROOM_CODE_MIN, length)
  );
  let code = "";
  for (let i = 0; i < size; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function createId(): string {
  return crypto.randomUUID();
}
