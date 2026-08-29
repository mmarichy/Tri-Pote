import {
  isValidRoomCode,
  normalizeRoomCode,
} from "../shared/roomCode";

const BASE_PATH = "/under-cover";

export function getRoomCodeFromUrl(): string | undefined {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  const prefix = BASE_PATH.replace(/\/+$/, "");

  if (!pathname.startsWith(prefix)) return undefined;

  const rest = pathname.slice(prefix.length).replace(/^\/+/, "");
  if (!rest) return undefined;

  const normalized = normalizeRoomCode(rest);
  return isValidRoomCode(normalized) ? normalized : undefined;
}

export function roomPath(code: string): string {
  return `${BASE_PATH}/${normalizeRoomCode(code)}`;
}

export function roomUrl(code: string): string {
  return `${window.location.origin}${roomPath(code)}`;
}

export function setRoomUrl(code: string): void {
  window.history.replaceState({}, "", roomPath(code));
}

export function clearRoomUrl(): void {
  window.history.replaceState({}, "", `${BASE_PATH}/`);
}

export function homePath(): string {
  return `${BASE_PATH}/`;
}
