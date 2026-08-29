import { isValidRoomCode, normalizeRoomCode } from "../shared/game";

export function getRoomCodeFromUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("room");
  if (fromQuery) {
    const normalized = normalizeRoomCode(fromQuery);
    if (isValidRoomCode(normalized)) return normalized;
  }

  const segment = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (!segment) return undefined;

  const normalized = normalizeRoomCode(segment);
  return isValidRoomCode(normalized) ? normalized : undefined;
}

export function roomPath(code: string): string {
  return `/${normalizeRoomCode(code)}`;
}

export function roomUrl(code: string): string {
  return `${window.location.origin}${roomPath(code)}`;
}

export function setRoomUrl(code: string): void {
  window.history.replaceState({}, "", roomPath(code));
}

export function clearRoomUrl(): void {
  window.history.replaceState({}, "", "/");
}

export function redirectQueryRoomToPath(): void {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("room");
  if (!fromQuery) return;

  const normalized = normalizeRoomCode(fromQuery);
  if (!isValidRoomCode(normalized)) return;

  window.history.replaceState({}, "", roomPath(normalized));
}
