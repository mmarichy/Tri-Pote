import { randomUUID } from "node:crypto";

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
