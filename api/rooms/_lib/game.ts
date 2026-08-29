import { randomUUID } from "crypto";

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
  return { choices: shuffle([question, ...decoys]) };
}

interface RankPlayer {
  id: string;
  name: string;
}

export function aggregateRankings(
  players: RankPlayer[],
  rankings: Record<string, string[]>
) {
  const points = new Map<string, number>();
  players.forEach((p) => points.set(p.id, 0));

  for (const orderedIds of Object.values(rankings)) {
    const n = orderedIds.length;
    orderedIds.forEach((id, index) => {
      points.set(id, (points.get(id) ?? 0) + (n - index));
    });
  }

  return [...players]
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      points: points.get(p.id) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i, sorted) => {
      let rank = 1;
      if (i > 0 && entry.points < sorted[i - 1].points) {
        rank = i + 1;
      } else if (i > 0) {
        rank = sorted[i - 1].rank;
      }
      return { ...entry, rank };
    });
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
  players: RankPlayer[],
  allRankings: Record<string, Record<string, string[]>>,
  questionIndex: number
): string | null {
  const perQuestion = rankingsForQuestion(allRankings, questionIndex);
  if (Object.keys(perQuestion).length === 0) return null;
  const results = aggregateRankings(players, perQuestion);
  return results[0]?.playerId ?? null;
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
  return randomUUID();
}
