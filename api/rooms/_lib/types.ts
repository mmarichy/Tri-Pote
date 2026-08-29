export type Phase =
  | "lobby"
  | "round-intro"
  | "ranking"
  | "guess"
  | "round-end"
  | "game-end";

export interface Player {
  id: string;
  name: string;
  score: number;
}

export type PlayerVotes = Record<string, Record<string, string>>;

export interface QuestionItem {
  id: number;
  theme: string;
  question: string;
}

export interface RoundState {
  questions: QuestionItem[];
  rankings: PlayerVotes;
  guesses: PlayerVotes;
  rankingDeadline: number;
  winners?: Record<string, string>;
  progress?: {
    rankingsDone: number;
    guessesDone: number;
    totalPlayers: number;
    totalQuestions: number;
  };
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  totalRounds: number;
  currentRound: number;
  usedQuestions: number[];
  questionsPerRound: number;
  round: RoundState | null;
  lastSeen: Record<string, number>;
}

export const DEFAULT_QUESTIONS_PER_ROUND = 4;
export const MAX_QUESTIONS_PER_ROUND = 20;
export const RANKING_TIMEOUT_MS = 60_000;
export const PLAYER_INACTIVE_MS = 90_000;

export type RoomAction =
  | { action: "join"; name: string }
  | { action: "leave"; playerId: string }
  | { action: "kick"; playerId: string; targetId: string }
  | { action: "start"; playerId: string; totalRounds: number; questionsPerRound: number }
  | { action: "begin-votes"; playerId: string }
  | {
      action: "rank";
      playerId: string;
      questionIndex: number;
      votedPlayerId: string;
    }
  | {
      action: "guess";
      playerId: string;
      questionIndex: number;
      guessedPlayerId: string;
    }
  | { action: "next-round"; playerId: string }
  | { action: "restart"; playerId: string };
