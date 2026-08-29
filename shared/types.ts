export type Phase =
  | "lobby"
  | "ranking"
  | "reveal"
  | "guess"
  | "round-end"
  | "game-end";

export interface QuestionsData {
  questions: string[];
}

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface RankingEntry {
  playerId: string;
  name: string;
  points: number;
  rank: number;
}

export interface RoundState {
  question: string;
  choices: string[];
  rankings: Record<string, string[]>;
  guesses: Record<string, string>;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  totalRounds: number;
  currentRound: number;
  usedQuestions: string[];
  round: RoundState | null;
}

export type RoomAction =
  | { action: "join"; name: string }
  | { action: "start"; playerId: string; totalRounds: number }
  | { action: "rank"; playerId: string; order: string[] }
  | { action: "continue"; playerId: string }
  | { action: "guess"; playerId: string; question: string }
  | { action: "next-round"; playerId: string }
  | { action: "restart"; playerId: string };

export interface Session {
  roomCode: string;
  playerId: string;
}
