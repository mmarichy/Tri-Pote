import { useCallback, useEffect, useState } from "react";
import type { RoomAction, RoomState, Session } from "../../shared/types";
import { clearSession, fetchRoom, saveSession, sendAction } from "../api/client";

export function useRoom(session: Session | null) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setRoom(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const poll = async () => {
      try {
        const data = await fetchRoom(session.roomCode);
        if (active) {
          setRoom(data);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erreur réseau");
          setLoading(false);
        }
      }
    };

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session?.roomCode]);

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
