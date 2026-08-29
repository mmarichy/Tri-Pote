export type Role = "civilian" | "undercover" | "mrwhite";

export type Phase =
  | "lobby"
  | "reveal"
  | "speaking"
  | "debate"
  | "vote"
  | "round-end"
  | "game-end";

export type Winner = "civilians" | "undercover" | "mrwhite";

export interface WordPair {
  id: string;
  civilian: string;
  undercover: string;
}

export interface Player {
  id: string;
  name: string;
  isAlive: boolean;
}

export interface RoomSettings {
  includeMrWhite: boolean;
  minPlayers: number;
}

export interface EliminationReveal {
  playerId: string;
  role: Role;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  settings: RoomSettings;
  round: number;
  wordPair: WordPair | null;
  roles: Record<string, Role>;
  speakingOrder: string[];
  currentSpeakerIndex: number;
  clues: Record<string, string>;
  revealAcks: Record<string, boolean>;
  votes: Record<string, string>;
  eliminatedThisRound: string | null;
  lastEliminated: EliminationReveal | null;
  winner: Winner | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerView {
  role: Role;
  word: string | null;
}

export interface RoomView {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  settings: RoomSettings;
  round: number;
  speakingOrder: string[];
  currentSpeakerIndex: number;
  clues: Record<string, string>;
  revealAcks: Record<string, boolean>;
  votes: Record<string, string>;
  eliminatedThisRound: string | null;
  lastEliminated: EliminationReveal | null;
  winner: Winner | null;
  me?: PlayerView;
}

export interface Session {
  roomCode: string;
  playerId: string;
}

export type RoomAction =
  | { action: "join"; name: string }
  | { action: "leave"; playerId: string }
  | { action: "kick"; playerId: string; targetId: string }
  | { action: "start"; playerId: string }
  | { action: "set-settings"; playerId: string; includeMrWhite: boolean }
  | { action: "ack-reveal"; playerId: string }
  | { action: "submit-clue"; playerId: string; clue: string }
  | { action: "advance-debate"; playerId: string }
  | { action: "vote"; playerId: string; targetId: string }
  | { action: "next-round"; playerId: string }
  | { action: "restart"; playerId: string };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const ROOM_CODE_MIN = 4;
export const ROOM_CODE_MAX = 6;
export const DEFAULT_ROOM_CODE_LENGTH = 5;
