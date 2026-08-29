import type { WordPair } from "./types";

export const WORD_PAIRS: WordPair[] = [
  { id: "1", civilian: "Pizza", undercover: "Tarte" },
  { id: "2", civilian: "Cinéma", undercover: "Théâtre" },
  { id: "3", civilian: "Plage", undercover: "Piscine" },
  { id: "4", civilian: "Chien", undercover: "Loup" },
  { id: "5", civilian: "Café", undercover: "Thé" },
  { id: "6", civilian: "Vélo", undercover: "Moto" },
  { id: "7", civilian: "Livre", undercover: "Magazine" },
  { id: "8", civilian: "Montagne", undercover: "Colline" },
  { id: "9", civilian: "Avion", undercover: "Hélicoptère" },
  { id: "10", civilian: "Guitare", undercover: "Violon" },
  { id: "11", civilian: "Hôpital", undercover: "Clinique" },
  { id: "12", civilian: "Rivière", undercover: "Lac" },
  { id: "13", civilian: "Chocolat", undercover: "Caramel" },
  { id: "14", civilian: "Football", undercover: "Rugby" },
  { id: "15", civilian: "Soleil", undercover: "Lune" },
  { id: "16", civilian: "Château", undercover: "Manoir" },
  { id: "17", civilian: "Docteur", undercover: "Infirmier" },
  { id: "18", civilian: "Banane", undercover: "Mangue" },
  { id: "19", civilian: "Ordinateur", undercover: "Tablette" },
  { id: "20", civilian: "Paris", undercover: "Londres" },
];

export function pickRandomWordPair(usedIds: string[] = []): WordPair {
  const available = WORD_PAIRS.filter((pair) => !usedIds.includes(pair.id));
  const pool = available.length > 0 ? available : WORD_PAIRS;
  return pool[Math.floor(Math.random() * pool.length)];
}
