export type Phase =
  | "lobby"
  | "ranking"
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

/** Classements par joueur → index question → ordre des joueurs */
export type PlayerRankings = Record<string, Record<string, string[]>>;

/** Devinettes par joueur → index question → id du joueur choisi */
export type PlayerGuesses = Record<string, Record<string, string>>;

export interface RoundState {
  questions: string[];
  rankings: PlayerRankings;
  guesses: PlayerGuesses;
  rankingDeadline: number;
  /** Gagnants par question — visible seulement en fin de manche */
  winners?: Record<string, string>;
  /** Progression agrégée (sans exposer les classements des autres) */
  progress?: {
    rankingsDone: number;
    guessesDone: number;
    totalPlayers: number;
  };
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
  lastSeen: Record<string, number>;
}

export const QUESTIONS_PER_ROUND = 4;
export const RANKING_TIMEOUT_MS = 60_000;
export const PLAYER_INACTIVE_MS = 90_000;

export type RoomAction =
  | { action: "join"; name: string }
  | { action: "leave"; playerId: string }
  | { action: "kick"; playerId: string; targetId: string }
  | { action: "start"; playerId: string; totalRounds: number }
  | {
      action: "rank";
      playerId: string;
      questionIndex: number;
      order: string[];
    }
  | {
      action: "guess";
      playerId: string;
      questionIndex: number;
      guessedPlayerId: string;
    }
  | { action: "next-round"; playerId: string }
  | { action: "restart"; playerId: string };

export interface Session {
  roomCode: string;
  playerId: string;
}
