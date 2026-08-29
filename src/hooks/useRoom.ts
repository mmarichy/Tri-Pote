import { useCallback, useEffect, useState } from "react";
import type { RoomAction, RoomState, Session } from "../../shared/types";
import { clearSession, fetchRoom, saveSession, sendAction } from "../api/client";

export function useRoom(
  session: Session | null,
  initialRoom: RoomState | null = null
) {
  const [room, setRoom] = useState<RoomState | null>(() => {
    if (initialRoom && session && initialRoom.code === session.roomCode) {
      return initialRoom;
    }
    return null;
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => {
    if (initialRoom && session && initialRoom.code === session.roomCode) {
      return false;
    }
    return Boolean(session);
  });

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
        const data = await fetchRoom(session.roomCode);
        if (active) {
          setRoom(data);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        setRoom((prev) => {
          if (prev) return prev;
          setError(err instanceof Error ? err.message : "Erreur réseau");
          setLoading(false);
          return null;
        });
      }
    };

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session?.roomCode, initialRoom]);

  const dispatch = useCallback(
    async (action: RoomAction) => {
      if (!session) return;
      const updated = await sendAction(session.roomCode, action);
      setRoom(updated);
      setError("");
      return updated;
    },
    [session]
  );

  const leave = useCallback(() => {
    clearSession();
    setRoom(null);
  }, []);

  const persist = useCallback((next: Session) => {
    saveSession(next);
  }, []);

  return { room, error, loading, dispatch, leave, persist };
}
