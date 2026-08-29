import type { Player, RankingEntry } from "./types";

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickQuestion(
  questions: string[],
  used: Set<string> | string[]
): string | null {
  const usedSet = used instanceof Set ? used : new Set(used);
  const available = questions.filter((q) => !usedSet.has(q));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function buildChoices(
  question: string,
  allQuestions: string[]
): { choices: string[] } {
  const others = allQuestions.filter((q) => q !== question);
  const decoys = shuffle(others).slice(0, 3);
  const choices = shuffle([question, ...decoys]);
  return { choices };
}

export function aggregateRankings(
  players: Player[],
  rankings: Record<string, string[]>
): RankingEntry[] {
  const points = new Map<string, number>();
  players.forEach((p) => points.set(p.id, 0));

  for (const orderedIds of Object.values(rankings)) {
    const n = orderedIds.length;
    orderedIds.forEach((id, index) => {
      points.set(id, (points.get(id) ?? 0) + (n - index));
    });
  }

  const sorted = [...players]
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      points: points.get(p.id) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points);

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].points < sorted[i - 1].points) {
      currentRank = i + 1;
    }
    sorted[i].rank = currentRank;
  }

  return sorted;
}

export function rankingsForQuestion(
  allRankings: Record<string, Record<string, string[]>>,
  questionIndex: number
): Record<string, string[]> {
  const key = String(questionIndex);
  const result: Record<string, string[]> = {};
  for (const [playerId, byQuestion] of Object.entries(allRankings)) {
    const order = byQuestion[key];
    if (order) result[playerId] = order;
  }
  return result;
}

export function getTopPlayerForQuestion(
  players: Player[],
  allRankings: Record<string, Record<string, string[]>>,
  questionIndex: number
): string | null {
  const perQuestion = rankingsForQuestion(allRankings, questionIndex);
  if (Object.keys(perQuestion).length === 0) return null;
  const results = aggregateRankings(players, perQuestion);
  return results[0]?.playerId ?? null;
}

export function countCompletedRankings(
  playerRankings: Record<string, string> | undefined,
  questionCount: number
): number {
  if (!playerRankings) return 0;
  let count = 0;
  for (let i = 0; i < questionCount; i++) {
    if (playerRankings[String(i)]) count++;
  }
  return count;
}

export function countCompletedGuesses(
  playerGuesses: Record<string, string> | undefined,
  questionCount: number
): number {
  if (!playerGuesses) return 0;
  let count = 0;
  for (let i = 0; i < questionCount; i++) {
    if (playerGuesses[String(i)]) count++;
  }
  return count;
}

export function nextPendingIndex(
  entries: Record<string, unknown> | undefined,
  count: number
): number | null {
  for (let i = 0; i < count; i++) {
    if (!entries?.[String(i)]) return i;
  }
  return null;
}

export function generateRoomCode(length = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4}$/.test(code);
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
