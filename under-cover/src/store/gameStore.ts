import { create } from "zustand";
import type { RoomView, Session } from "../../shared/types";

interface GameStore {
  session: Session | null;
  room: RoomView | null;
  loading: boolean;
  error: string;
  setSession: (session: Session | null) => void;
  setRoom: (room: RoomView | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  session: null,
  room: null,
  loading: false,
  error: "",
  setSession: (session) => set({ session }),
  setRoom: (room) => set({ room }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ session: null, room: null, loading: false, error: "" }),
}));
