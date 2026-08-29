import type { RoomAction, RoomState, Session } from "../../shared/types";
import { normalizeRoomCode } from "../../shared/game";

const SESSION_KEY = "vote_session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Erreur inconnue";
  } catch {
    return "Erreur réseau";
  }
}

export async function createRoom(hostName: string): Promise<{
  room: RoomState;
  playerId: string;
}> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchRoomMeta(code: string): Promise<{ exists: boolean }> {
  const normalized = normalizeRoomCode(code);
  const res = await fetch(`/api/rooms/${normalized}?meta=1`);
  if (!res.ok) return { exists: false };
  return res.json();
}

export async function fetchRoom(code: string): Promise<RoomState> {
  const normalized = normalizeRoomCode(code);
  const res = await fetch(`/api/rooms/${normalized}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { room: RoomState };
  return data.room;
}

export async function sendAction(
  code: string,
  action: RoomAction
): Promise<RoomState> {
  const normalized = normalizeRoomCode(code);
  const res = await fetch(`/api/rooms/${normalized}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { room: RoomState };
  return data.room;
}
