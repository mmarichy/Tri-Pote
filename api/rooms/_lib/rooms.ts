import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  createId,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  pickQuestion,
} from "./game.js";
import type { Player, QuestionItem, RoomAction, RoomState } from "./types.js";
import {
  PLAYER_INACTIVE_MS,
  QUESTIONS_PER_ROUND,
  RANKING_TIMEOUT_MS,
} from "./types.js";
import { deleteRoom, getRoom, roomExists, saveRoom } from "./store.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadQuestions(): QuestionItem[] {
  const file = join(moduleDir, "questions.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as {
    questions: QuestionItem[];
  };
  return data.questions;
}

function assertQuestions() {
  const questions = loadQuestions();
  if (questions.length < 4) {
    throw new Error("Il faut au moins 4 questions dans questions.json");
  }
}

function isHost(room: RoomState, playerId: string): boolean {
  return room.hostId === playerId;
}

function findPlayer(room: RoomState, playerId: string): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

function allRankingsComplete(room: RoomState): boolean {
  if (!room.round) return false;
  const qCount = room.round.questions.length;
  return room.players.every((p) =>
    isPlayerVotesComplete(room.round!.rankings[p.id], qCount)
  );
}

function allGuessesComplete(room: RoomState): boolean {
  if (!room.round) return false;
  const qCount = room.round.questions.length;
  return room.players.every((p) =>
    isPlayerVotesComplete(room.round!.guesses[p.id], qCount)
  );
}

function isPlayerVotesComplete(
  entries: Record<string, string> | undefined,
  questionCount: number
): boolean {
  if (!entries) return false;
  for (let i = 0; i < questionCount; i++) {
    if (!entries[String(i)]) return false;
  }
  return true;
}

function scoreRound(room: RoomState): void {
  if (!room.round?.winners) return;

  room.players = room.players.map((p) => {
    const byPlayer = room.round!.guesses[p.id] ?? {};
    let gained = 0;
    for (let i = 0; i < room.round!.questions.length; i++) {
      const key = String(i);
      if (byPlayer[key] === room.round!.winners![key]) gained += 1;
    }
    return { ...p, score: p.score + gained };
  });
}

function isPlayerRankingComplete(
  playerRankings: Record<string, string> | undefined,
  questionCount: number
): boolean {
  return isPlayerVotesComplete(playerRankings, questionCount);
}

function isPlayerGuessesComplete(
  playerGuesses: Record<string, string> | undefined,
  questionCount: number
): boolean {
  return isPlayerVotesComplete(playerGuesses, questionCount);
}

function computeWinners(room: RoomState): Record<string, string> {
  if (!room.round) return {};
  const winners: Record<string, string> = {};

  for (let i = 0; i < room.round.questions.length; i++) {
    const key = String(i);
    const counts = new Map<string, number>();

    for (const player of room.players) {
      const vote = room.round.rankings[player.id]?.[key];
      if (vote) counts.set(vote, (counts.get(vote) ?? 0) + 1);
    }

    let bestId = room.players[0]?.id ?? "";
    let bestCount = -1;
    for (const [id, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    }
    if (bestCount >= 0) winners[key] = bestId;
  }

  return winners;
}

function finalizeRankingPhase(room: RoomState): RoomState {
  if (!room.round) return room;
  room.round.winners = computeWinners(room);
  room.phase = "guess";
  return room;
}

function buildProgress(room: RoomState) {
  if (!room.round) {
    return { rankingsDone: 0, guessesDone: 0, totalPlayers: room.players.length };
  }
  const qCount = room.round.questions.length;
  return {
    rankingsDone: room.players.filter((p) =>
      isPlayerRankingComplete(room.round!.rankings[p.id], qCount)
    ).length,
    guessesDone: room.players.filter((p) =>
      isPlayerGuessesComplete(room.round!.guesses[p.id], qCount)
    ).length,
    totalPlayers: room.players.length,
  };
}

function sanitizeRoomForPlayer(room: RoomState, viewerId?: string): RoomState {
  if (!room.round) return room;

  const progress = buildProgress(room);

  if (room.phase === "ranking" && viewerId) {
    const own = room.round.rankings[viewerId];
    return {
      ...room,
      round: {
        ...room.round,
        rankings: own ? { [viewerId]: own } : {},
        guesses: {},
        winners: undefined,
        progress,
      },
    };
  }

  if (room.phase === "guess") {
    const ownGuesses = viewerId ? room.round.guesses[viewerId] : undefined;
    return {
      ...room,
      round: {
        ...room.round,
        rankings: {},
        guesses:
          ownGuesses && viewerId ? { [viewerId]: ownGuesses } : {},
        winners: undefined,
        progress,
      },
    };
  }

  if (room.phase === "round-end") {
    return {
      ...room,
      round: {
        ...room.round,
        progress,
      },
    };
  }

  return room;
}

function cleanNestedRankings(
  rankings: Record<string, Record<string, string>>,
  removedId: string
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [pid, byQ] of Object.entries(rankings)) {
    if (pid === removedId) continue;
    result[pid] = { ...byQ };
  }
  return result;
}

function cleanNestedGuesses(
  guesses: Record<string, Record<string, string>>,
  removedId: string
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [pid, byQ] of Object.entries(guesses)) {
    if (pid === removedId) continue;
    result[pid] = { ...byQ };
  }
  return result;
}

function removePlayerFromRoom(
  room: RoomState,
  playerId: string
): RoomState | null {
  if (!findPlayer(room, playerId)) return room;

  const players = room.players.filter((p) => p.id !== playerId);
  if (players.length === 0) return null;

  let hostId = room.hostId;
  if (hostId === playerId) {
    hostId = players[0].id;
  }

  let next: RoomState = { ...room, players, hostId };

  if (next.lastSeen) {
    const { [playerId]: _removed, ...rest } = next.lastSeen;
    next.lastSeen = rest;
  }

  if (next.round) {
    next = {
      ...next,
      round: {
        ...next.round,
        rankings: cleanNestedRankings(next.round.rankings, playerId),
        guesses: cleanNestedGuesses(next.round.guesses, playerId),
      },
    };
  }

  if (
    players.length < 2 &&
    next.phase !== "lobby" &&
    next.phase !== "game-end"
  ) {
    next = {
      ...next,
      phase: "lobby",
      currentRound: 0,
      usedQuestions: [],
      round: null,
      players: players.map((p) => ({ ...p, score: 0 })),
    };
  } else if (next.phase === "ranking" && next.round) {
    if (allRankingsComplete(next)) {
      next = finalizeRankingPhase(next);
    }
  } else if (next.phase === "guess" && next.round) {
    if (allGuessesComplete(next)) {
      scoreRound(next);
      next.phase = "round-end";
    }
  }

  return next;
}

function applyRankingTimeout(room: RoomState): RoomState {
  if (room.phase !== "ranking" || !room.round) return room;
  if (Date.now() < room.round.rankingDeadline) return room;

  const playerIds = room.players.map((p) => p.id);
  for (const player of room.players) {
    if (!room.round.rankings[player.id]) {
      room.round.rankings[player.id] = {};
    }
    for (let i = 0; i < room.round.questions.length; i++) {
      const key = String(i);
      if (!room.round.rankings[player.id][key]) {
        room.round.rankings[player.id][key] =
          playerIds[Math.floor(Math.random() * playerIds.length)];
      }
    }
  }
  return finalizeRankingPhase(room);
}

function ensureLastSeen(room: RoomState): RoomState {
  if (room.lastSeen) return room;
  const now = Date.now();
  return {
    ...room,
    lastSeen: Object.fromEntries(room.players.map((p) => [p.id, now])),
  };
}

function touchPresence(room: RoomState, playerId: string): RoomState {
  const next = ensureLastSeen(room);
  if (!findPlayer(next, playerId)) return next;
  return {
    ...next,
    lastSeen: { ...next.lastSeen, [playerId]: Date.now() },
  };
}

function applyInactivePlayers(room: RoomState): RoomState | null {
  const base = ensureLastSeen(room);
  const now = Date.now();
  const inactive = base.players.filter((p) => {
    const seen = base.lastSeen[p.id] ?? 0;
    return now - seen > PLAYER_INACTIVE_MS;
  });
  if (inactive.length === 0) return base;

  let next: RoomState | null = base;
  for (const player of inactive) {
    if (!next) break;
    next = removePlayerFromRoom(next, player.id);
  }
  return next;
}

function processRoom(
  room: RoomState,
  activePlayerId?: string
): RoomState | null {
  let next = ensureLastSeen(room);
  if (activePlayerId) {
    next = touchPresence(next, activePlayerId);
  }
  next = applyInactivePlayers(next);
  if (!next) return null;
  return applyRankingTimeout(next);
}

async function persistRoom(room: RoomState | null, code: string): Promise<void> {
  if (!room) {
    await deleteRoom(code);
    return;
  }
  await saveRoom(room);
}

function startRound(room: RoomState): RoomState {
  const pool = loadQuestions();
  const roundQuestions: QuestionItem[] = [];
  const used = [...room.usedQuestions];

  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const item = pickQuestion(pool, used);
    if (!item) break;
    roundQuestions.push(item);
    used.push(item.id);
  }

  if (roundQuestions.length === 0) {
    return { ...room, phase: "game-end", round: null };
  }

  return {
    ...room,
    phase: "ranking",
    usedQuestions: used,
    round: {
      questions: roundQuestions,
      rankings: {},
      guesses: {},
      rankingDeadline:
        Date.now() + RANKING_TIMEOUT_MS * roundQuestions.length,
    },
  };
}

export async function createRoom(hostName: string): Promise<RoomState> {
  assertQuestions();
  const name = hostName.trim();
  if (!name) throw new Error("Nom requis");

  let code = generateRoomCode();
  let attempts = 0;
  while (await roomExists(code)) {
    code = generateRoomCode();
    attempts += 1;
    if (attempts > 20) {
      throw new Error("Impossible de générer un code unique");
    }
  }

  const hostId = createId();
  const now = Date.now();
  const room: RoomState = {
    code,
    hostId,
    players: [{ id: hostId, name, score: 0 }],
    phase: "lobby",
    totalRounds: 5,
    currentRound: 0,
    usedQuestions: [],
    round: null,
    lastSeen: { [hostId]: now },
  };

  await saveRoom(room);
  return room;
}

export async function handleAction(
  code: string,
  payload: RoomAction
): Promise<RoomState> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    throw new Error("Code de salon invalide");
  }

  let room = await getRoom(normalized);
  if (!room) throw new Error("Salon introuvable");

  const activePlayerId =
    "playerId" in payload ? payload.playerId : undefined;
  room = processRoom(room, activePlayerId);
  if (!room) throw new Error("Salon introuvable");

  switch (payload.action) {
    case "join": {
      const name = payload.name.trim();
      if (!name) throw new Error("Nom requis");
      if (room.phase !== "lobby") {
        throw new Error("La partie a déjà commencé");
      }
      if (
        room.players.some(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        throw new Error("Ce pseudo est déjà pris");
      }
      const newId = createId();
      room.players.push({ id: newId, name, score: 0 });
      room = touchPresence(room, newId);
      await saveRoom(room);
      return room;
    }

    case "leave": {
      if (!findPlayer(room, payload.playerId)) {
        throw new Error("Joueur inconnu");
      }
      const next = removePlayerFromRoom(room, payload.playerId);
      await persistRoom(next, normalized);
      if (!next) throw new Error("Salon fermé");
      return next;
    }

    case "kick": {
      if (!isHost(room, payload.playerId)) {
        throw new Error("Seul l'hôte peut expulser un joueur");
      }
      if (room.phase !== "lobby") {
        throw new Error("Impossible d'expulser en pleine partie");
      }
      if (payload.targetId === payload.playerId) {
        throw new Error("Tu ne peux pas t'expulser toi-même");
      }
      if (!findPlayer(room, payload.targetId)) {
        throw new Error("Joueur introuvable");
      }
      const next = removePlayerFromRoom(room, payload.targetId);
      await persistRoom(next, normalized);
      if (!next) throw new Error("Salon fermé");
      return next;
    }

    case "start": {
      if (!isHost(room, payload.playerId)) {
        throw new Error("Seul l'hôte peut lancer la partie");
      }
      if (room.phase !== "lobby") {
        throw new Error("La partie est déjà lancée");
      }
      if (room.players.length < 2) {
        throw new Error("Il faut au moins 2 joueurs");
      }
      if (payload.totalRounds < 1) {
        throw new Error("Il faut au moins 1 manche");
      }

      room.totalRounds = payload.totalRounds;
      room.currentRound = 1;
      room.players = room.players.map((p) => ({ ...p, score: 0 }));
      room.usedQuestions = [];
      const next = startRound(room);
      await saveRoom(next);
      return next;
    }

    case "rank": {
      if (room.phase !== "ranking" || !room.round) {
        throw new Error("Phase invalide");
      }
      if (!findPlayer(room, payload.playerId)) {
        throw new Error("Joueur inconnu");
      }

      const qIndex = payload.questionIndex;
      if (qIndex < 0 || qIndex >= room.round.questions.length) {
        throw new Error("Question invalide");
      }

      if (!room.round.rankings[payload.playerId]) {
        room.round.rankings[payload.playerId] = {};
      }
      const qKey = String(qIndex);
      if (room.round.rankings[payload.playerId][qKey]) {
        throw new Error("Vote déjà envoyé pour cette question");
      }
      if (!findPlayer(room, payload.votedPlayerId)) {
        throw new Error("Joueur invalide");
      }

      room.round.rankings[payload.playerId][qKey] = payload.votedPlayerId;

      if (allRankingsComplete(room)) {
        room = finalizeRankingPhase(room);
      }

      await saveRoom(room);
      return sanitizeRoomForPlayer(room, payload.playerId);
    }

    case "guess": {
      if (room.phase !== "guess" || !room.round) {
        throw new Error("Phase invalide");
      }
      if (!findPlayer(room, payload.playerId)) {
        throw new Error("Joueur inconnu");
      }

      const qIndex = payload.questionIndex;
      if (qIndex < 0 || qIndex >= room.round.questions.length) {
        throw new Error("Question invalide");
      }
      if (!findPlayer(room, payload.guessedPlayerId)) {
        throw new Error("Joueur invalide");
      }

      if (!room.round.guesses[payload.playerId]) {
        room.round.guesses[payload.playerId] = {};
      }
      const qKey = String(qIndex);
      if (room.round.guesses[payload.playerId][qKey]) {
        throw new Error("Réponse déjà envoyée");
      }

      room.round.guesses[payload.playerId][qKey] = payload.guessedPlayerId;

      if (allGuessesComplete(room)) {
        scoreRound(room);
        room.phase = "round-end";
      }

      await saveRoom(room);
      return sanitizeRoomForPlayer(room, payload.playerId);
    }

    case "next-round": {
      if (!isHost(room, payload.playerId)) {
        throw new Error("Seul l'hôte peut continuer");
      }
      if (room.phase !== "round-end") {
        throw new Error("Phase invalide");
      }
      if (room.currentRound >= room.totalRounds) {
        room.phase = "game-end";
        room.round = null;
        await saveRoom(room);
        return room;
      }

      room.currentRound += 1;
      const next = startRound(room);
      await saveRoom(next);
      return next;
    }

    case "restart": {
      if (!isHost(room, payload.playerId)) {
        throw new Error("Seul l'hôte peut relancer");
      }
      room.phase = "lobby";
      room.currentRound = 0;
      room.usedQuestions = [];
      room.round = null;
      room.players = room.players.map((p) => ({ ...p, score: 0 }));
      await saveRoom(room);
      return room;
    }

    default:
      throw new Error("Action inconnue");
  }
}

export async function getRoomState(
  code: string,
  playerId?: string
): Promise<RoomState> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    throw new Error("Code de salon invalide");
  }
  const room = await getRoom(normalized);
  if (!room) throw new Error("Salon introuvable");

  const processed = processRoom(room, playerId);
  if (!processed) throw new Error("Salon introuvable");

  if (processed !== room) {
    await saveRoom(processed);
  }
  return sanitizeRoomForPlayer(processed, playerId);
}

export async function getRoomMeta(code: string): Promise<{ exists: boolean }> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    return { exists: false };
  }
  const room = await getRoom(normalized);
  if (!room) return { exists: false };

  const processed = processRoom(room);
  if (!processed) {
    await deleteRoom(normalized);
    return { exists: false };
  }
  if (processed !== room) {
    await saveRoom(processed);
  }
  return { exists: true };
}
