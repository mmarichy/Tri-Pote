import type { RoomAction, RoomView, Session } from "../../shared/types";
import { normalizeRoomCode } from "../../shared/roomCode";

const SESSION_KEY = "undercover_session";
const API_BASE = "/api/under-cover";

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
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) return data.error;
    } catch {
      /* réponse non-JSON */
    }
    if (res.status >= 500) {
      return "Serveur indisponible — réessaie dans quelques instants.";
    }
    return `Erreur ${res.status}`;
  } catch {
    return "Erreur réseau — vérifie ta connexion.";
  }
}

export async function createRoom(hostName: string): Promise<{
  room: RoomView;
  playerId: string;
}> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchRoomMeta(code: string): Promise<{ exists: boolean }> {
  const normalized = normalizeRoomCode(code);
  const res = await fetch(`${API_BASE}/${normalized}?meta=1`);
  if (!res.ok) return { exists: false };
  return res.json();
}

export async function fetchRoom(
  code: string,
  playerId?: string
): Promise<RoomView> {
  const normalized = normalizeRoomCode(code);
  const query = playerId
    ? `?playerId=${encodeURIComponent(playerId)}`
    : "";
  const res = await fetch(`${API_BASE}/${normalized}${query}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { room: RoomView };
  return data.room;
}

export async function sendAction(
  code: string,
  action: RoomAction
): Promise<RoomView> {
  const normalized = normalizeRoomCode(code);
  const res = await fetch(`${API_BASE}/${normalized}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { room: RoomView };
  return data.room;
}
