import { useEffect, useState } from "react";
import {
  createRoom,
  fetchRoomMeta,
  saveSession,
  sendAction,
} from "../api/client";
import { normalizeRoomCode } from "../../shared/roomCode";
import { ROOM_CODE_MAX } from "../../shared/types";
import type { RoomView, Session } from "../../shared/types";

interface HomeProps {
  onSession: (session: Session, room?: RoomView) => void;
  initialCode?: string;
}

export function Home({ onSession, initialCode }: HomeProps) {
  const [mode, setMode] = useState<"create" | "join">(
    initialCode ? "join" : "create"
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [codeChecked, setCodeChecked] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "join") return;

    const normalized = normalizeRoomCode(code);
    if (normalized.length < 4) {
      setCodeChecked(null);
      return;
    }

    setCodeChecked(null);
    let active = true;
    fetchRoomMeta(normalized).then((meta) => {
      if (!active) return;
      setCodeChecked(meta.exists);
    });

    return () => {
      active = false;
    };
  }, [code, mode]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { room, playerId } = await createRoom(name);
      const session = { roomCode: room.code, playerId };
      saveSession(session);
      onSession(session, room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const normalized = normalizeRoomCode(code);
    if (!name.trim() || normalized.length < 4) return;
    setBusy(true);
    setError("");
    try {
      const room = await sendAction(normalized, {
        action: "join",
        name,
      });
      const me = room.players.find(
        (player: { name: string }) =>
          player.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (!me) throw new Error("Joueur introuvable");
      const session = { roomCode: room.code, playerId: me.id };
      saveSession(session);
      onSession(session, room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-undercover-surface p-1">
        <button
          type="button"
          className={`rounded-lg py-2.5 text-sm font-semibold transition ${
            mode === "create"
              ? "bg-undercover-accent text-white"
              : "text-undercover-muted"
          }`}
          onClick={() => setMode("create")}
        >
          Créer
        </button>
        <button
          type="button"
          className={`rounded-lg py-2.5 text-sm font-semibold transition ${
            mode === "join"
              ? "bg-undercover-accent text-white"
              : "text-undercover-muted"
          }`}
          onClick={() => setMode("join")}
        >
          Rejoindre
        </button>
      </div>

      <div className="uc-card space-y-4">
        <div>
          <label className="uc-label" htmlFor="name">
            Ton pseudo
          </label>
          <input
            id="name"
            className="uc-input"
            type="text"
            placeholder="Prénom..."
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {mode === "create" && (
          <p className="uc-hint">
            Un code unique sera généré automatiquement (4 à 6 caractères).
          </p>
        )}

        {mode === "join" && (
          <div>
            <label className="uc-label" htmlFor="code">
              Code de la partie
            </label>
            <input
              id="code"
              className="uc-input text-center font-mono text-xl tracking-[0.25em]"
              type="text"
              placeholder="ABCDE"
              value={code}
              onChange={(event) =>
                setCode(
                  normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_MAX)
                )
              }
              maxLength={ROOM_CODE_MAX}
              autoCapitalize="characters"
              spellCheck={false}
            />
            {code.length >= 4 && codeChecked === false && (
              <p className="mt-2 text-sm text-red-400">
                Partie introuvable — vérifie le code
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="uc-error">{error}</p>}

      <button
        className="uc-btn-primary"
        type="button"
        disabled={
          busy ||
          !name.trim() ||
          (mode === "join" &&
            (normalizeRoomCode(code).length < 4 || codeChecked !== true))
        }
        onClick={mode === "create" ? handleCreate : handleJoin}
      >
        {mode === "create" ? "Créer une partie" : "Rejoindre la partie"}
      </button>
    </div>
  );
}
