import { useEffect, useState } from "react";
import { clearSession, loadSession, saveSession } from "./api/client";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { GameLoop } from "./components/GameLoop";
import { useRoom } from "./hooks/useRoom";
import type { RoomView, Session } from "../shared/types";
import { clearRoomUrl, getRoomCodeFromUrl, setRoomUrl } from "./url";

function GameScreen({
  session,
  initialRoom,
  onLeave,
}: {
  session: Session;
  initialRoom: RoomView | null;
  onLeave: () => void;
}) {
  const { room, error, loading, dispatch, leave } = useRoom(session, initialRoom);

  const handleLeave = async () => {
    await leave();
    onLeave();
  };

  if (loading && !room) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-undercover-accent border-t-transparent" />
        <p className="text-undercover-muted">Connexion à la partie...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-4">
        <p className="uc-error">{error || "Partie introuvable"}</p>
        <button className="uc-btn-primary" type="button" onClick={handleLeave}>
          Retour
        </button>
      </div>
    );
  }

  const isHost = room.hostId === session.playerId;

  return (
    <>
      <button
        className="mb-4 text-sm text-undercover-muted hover:text-white"
        type="button"
        onClick={handleLeave}
      >
        ← Quitter
      </button>

      {error && <p className="uc-error mb-4">{error}</p>}

      {room.phase !== "lobby" && room.phase !== "game-end" && (
        <div className="mb-4 flex items-center justify-between text-sm text-undercover-muted">
          <span>Manche {room.round}</span>
          <span className="rounded-full bg-undercover-surface px-3 py-1 font-mono">
            {room.code}
          </span>
        </div>
      )}

      {room.phase === "lobby" && (
        <Lobby
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          onStart={async () => {
            await dispatch({ action: "start", playerId: session.playerId });
          }}
          onSetSettings={async (includeMrWhite) => {
            await dispatch({
              action: "set-settings",
              playerId: session.playerId,
              includeMrWhite,
            });
          }}
          onKick={async (targetId) => {
            await dispatch({
              action: "kick",
              playerId: session.playerId,
              targetId,
            });
          }}
        />
      )}

      {room.phase !== "lobby" && (
        <GameLoop
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          dispatch={dispatch}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}

export default function App() {
  const joinCode = getRoomCodeFromUrl();

  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession();
    if (!saved) return null;
    if (joinCode && saved.roomCode !== joinCode) return null;
    return saved;
  });
  const [initialRoom, setInitialRoom] = useState<RoomView | null>(null);

  useEffect(() => {
    if (session) setRoomUrl(session.roomCode);
  }, [session]);

  const handleLeave = () => {
    clearSession();
    setSession(null);
    setInitialRoom(null);
    clearRoomUrl();
  };

  const handleSession = (next: Session, room?: RoomView) => {
    saveSession(next);
    setSession(next);
    setInitialRoom(room ?? null);
    setRoomUrl(next.roomCode);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.15),_transparent_50%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <header className="mb-6 text-center">
          <div className="text-4xl">🕵️</div>
          <h1 className="mt-2 font-display text-2xl font-bold">Undercover</h1>
          <p className="text-sm text-undercover-muted">
            Jeu de rôles à identités cachées
          </p>
        </header>

        <main className="flex-1">
          {session ? (
            <GameScreen
              session={session}
              initialRoom={initialRoom}
              onLeave={handleLeave}
            />
          ) : (
            <Home onSession={handleSession} initialCode={joinCode} />
          )}
        </main>
      </div>
    </div>
  );
}
