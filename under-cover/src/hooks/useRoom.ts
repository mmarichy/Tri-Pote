import { useCallback, useEffect, useRef } from "react";
import type { Player, RoomAction, RoomView, Session } from "../../shared/types";
import {
  clearSession,
  fetchRoom,
  saveSession,
  sendAction,
} from "../api/client";
import { useGameStore } from "../store/gameStore";

export function useRoom(
  session: Session | null,
  initialRoom: RoomView | null = null
) {
  const room = useGameStore((state) => state.room);
  const error = useGameStore((state) => state.error);
  const loading = useGameStore((state) => state.loading);
  const setRoom = useGameStore((state) => state.setRoom);
  const setError = useGameStore((state) => state.setError);
  const setLoading = useGameStore((state) => state.setLoading);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!session) {
      setRoom(null);
      setLoading(false);
      return;
    }

    if (initialRoom && initialRoom.code === session.roomCode) {
      setRoom(initialRoom);
      setLoading(false);
    }

    let active = true;

    const poll = async () => {
      try {
        const data = await fetchRoom(session.roomCode, session.playerId);
        if (!active) return;

        const stillInRoom = data.players.some(
          (player: Player) => player.id === session.playerId
        );
        if (!stillInRoom) {
          clearSession();
          setRoom(null);
          setError("Tu n'es plus dans ce salon");
          setLoading(false);
          return;
        }

        setRoom(data);
        setError("");
        setLoading(false);
      } catch (err) {
        if (!active) return;
        const currentRoom = useGameStore.getState().room;
        if (!currentRoom) {
          setError(err instanceof Error ? err.message : "Erreur réseau");
          setLoading(false);
          setRoom(null);
        }
      }
    };

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session?.roomCode, session?.playerId, initialRoom, setRoom, setError, setLoading]);

  const dispatch = useCallback(
    async (action: RoomAction) => {
      if (!session) return;
      const updated = await sendAction(session.roomCode, action);
      setRoom(updated);
      setError("");
      return updated;
    },
    [session, setRoom, setError]
  );

  const leave = useCallback(async () => {
    leavingRef.current = true;
    if (session) {
      try {
        await sendAction(session.roomCode, {
          action: "leave",
          playerId: session.playerId,
        });
      } catch {
        /* salon déjà fermé */
      }
    }
    clearSession();
    setRoom(null);
  }, [session, setRoom]);

  const persist = useCallback((next: Session) => {
    saveSession(next);
  }, []);

  return { room, error, loading, dispatch, leave, persist };
}
