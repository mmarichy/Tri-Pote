import { useState } from "react";
import type { RoomView } from "../../shared/types";
import { MIN_PLAYERS } from "../../shared/types";
import { RoomCodeBanner } from "./RoomCodeBanner";

interface LobbyProps {
  room: RoomView;
  playerId: string;
  isHost: boolean;
  onStart: () => Promise<void>;
  onSetSettings: (includeMrWhite: boolean) => Promise<void>;
  onKick: (targetId: string) => Promise<void>;
}

export function Lobby({
  room,
  playerId,
  isHost,
  onStart,
  onSetSettings,
  onKick,
}: LobbyProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const handleStart = async () => {
    setBusy(true);
    setError("");
    try {
      await onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleMrWhite = async () => {
    setError("");
    try {
      await onSetSettings(!room.settings.includeMrWhite);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="space-y-4">
      <RoomCodeBanner code={room.code} />

      <div className="uc-card">
        <h2 className="mb-3 font-display text-lg font-bold">
          Joueurs ({room.players.length})
        </h2>
        <ul className="space-y-2">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-xl bg-undercover-surface px-4 py-3"
            >
              <span>
                {player.name}
                {player.id === room.hostId && " 👑"}
                {player.id === playerId && " (toi)"}
              </span>
              {isHost && player.id !== playerId && (
                <button
                  className="text-sm text-red-400 hover:text-red-300"
                  type="button"
                  disabled={kickingId === player.id}
                  onClick={async () => {
                    setKickingId(player.id);
                    setError("");
                    try {
                      await onKick(player.id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur");
                    } finally {
                      setKickingId(null);
                    }
                  }}
                >
                  Expulser
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="uc-card space-y-4">
          <h2 className="font-display text-lg font-bold">Paramètres</h2>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">
              Inclure Mr. White
              <span className="mt-0.5 block text-xs text-undercover-muted">
                Joueur sans mot (4+ joueurs)
              </span>
            </span>
            <button
              type="button"
              className={`relative h-8 w-14 rounded-full transition ${
                room.settings.includeMrWhite
                  ? "bg-undercover-accent"
                  : "bg-undercover-border"
              }`}
              onClick={toggleMrWhite}
              aria-pressed={room.settings.includeMrWhite}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                  room.settings.includeMrWhite ? "left-7" : "left-1"
                }`}
              />
            </button>
          </label>

          <p className="uc-hint">
            Minimum {MIN_PLAYERS} joueurs pour lancer la partie.
          </p>

          {error && <p className="uc-error">{error}</p>}

          <button
            className="uc-btn-primary"
            type="button"
            disabled={busy || room.players.length < MIN_PLAYERS}
            onClick={handleStart}
          >
            Lancer la partie
          </button>
        </div>
      ) : (
        <div className="uc-card text-center">
          <p className="text-undercover-muted">
            En attente que l&apos;hôte lance la partie...
          </p>
        </div>
      )}
    </div>
  );
}
