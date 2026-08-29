import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  buildChoices,
  createId,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  pickQuestion,
  shuffle,
} from "./game.js";
import type { Player, RoomAction, RoomState } from "./types.js";
import { RANKING_TIMEOUT_MS } from "./types.js";
import { deleteRoom, getRoom, roomExists, saveRoom } from "./store.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadQuestions(): string[] {
  const file = join(moduleDir, "questions.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as {
    questions: string[];
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

function allPlayersSubmitted(
  room: RoomState,
  field: "rankings" | "guesses"
): boolean {
  if (!room.round) return false;
  const submitted = Object.keys(room.round[field]);
  return submitted.length >= room.players.length;
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

  if (next.round) {
    const rankings: Record<string, string[]> = {};
    for (const [pid, order] of Object.entries(next.round.rankings)) {
      if (pid === playerId) continue;
      rankings[pid] = order.filter((id) => id !== playerId);
    }

    const guesses: Record<string, string> = {};
    for (const [pid, guess] of Object.entries(next.round.guesses)) {
      if (pid !== playerId) guesses[pid] = guess;
    }

    next = {
      ...next,
      round: { ...next.round, rankings, guesses },
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
    if (allPlayersSubmitted(next, "rankings")) {
      next.phase = "reveal";
    }
  } else if (next.phase === "guess" && next.round) {
    if (allPlayersSubmitted(next, "guesses")) {
      const correct = next.round.question;
      next.players = next.players.map((p) => {
        if (next.round!.guesses[p.id] === correct) {
          return { ...p, score: p.score + 1 };
        }
        return p;
      });
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
      room.round.rankings[player.id] = shuffle([...playerIds]);
    }
  }
  room.phase = "reveal";
  return room;
}

async function persistRoom(room: RoomState | null, code: string): Promise<void> {
  if (!room) {
    await deleteRoom(code);
    return;
  }
  await saveRoom(room);
}

function startRound(room: RoomState): RoomState {
  const questions = loadQuestions();
  const question = pickQuestion(questions, room.usedQuestions);
  if (!question) {
    return { ...room, phase: "game-end", round: null };
  }

  const { choices } = buildChoices(question, questions);

  return {
    ...room,
    phase: "ranking",
    usedQuestions: [...room.usedQuestions, question],
    round: {
      question,
      choices,
      rankings: {},
      guesses: {},
      rankingDeadline: Date.now() + RANKING_TIMEOUT_MS,
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
  const room: RoomState = {
    code,
    hostId,
    players: [{ id: hostId, name, score: 0 }],
    phase: "lobby",
    totalRounds: 5,
    currentRound: 0,
    usedQuestions: [],
    round: null,
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

  const afterTimeout = applyRankingTimeout(room);
  if (afterTimeout !== room) {
    await saveRoom(afterTimeout);
    room = afterTimeout;
  }

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
      room.players.push({ id: createId(), name, score: 0 });
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
      if (room.round.rankings[payload.playerId]) {
        throw new Error("Classement déjà envoyé");
      }

      const order = payload.order;
      const expected = room.players.map((p) => p.id);
      if (order.length !== expected.length) {
        throw new Error("Classement incomplet");
      }
      const sortedExpected = [...expected].sort();
      const sortedOrder = [...order].sort();
      if (sortedExpected.some((id, i) => id !== sortedOrder[i])) {
        throw new Error("Classement invalide");
      }

      room.round.rankings[payload.playerId] = order;

      if (allPlayersSubmitted(room, "rankings")) {
        room.phase = "reveal";
      }

      await saveRoom(room);
      return room;
    }

    case "continue": {
      if (!isHost(room, payload.playerId)) {
        throw new Error("Seul l'hôte peut continuer");
      }
      if (room.phase !== "reveal") {
        throw new Error("Phase invalide");
      }
      room.phase = "guess";
      await saveRoom(room);
      return room;
    }

    case "guess": {
      if (room.phase !== "guess" || !room.round) {
        throw new Error("Phase invalide");
      }
      if (!findPlayer(room, payload.playerId)) {
        throw new Error("Joueur inconnu");
      }
      if (room.round.guesses[payload.playerId]) {
        throw new Error("Réponse déjà envoyée");
      }
      if (!room.round.choices.includes(payload.question)) {
        throw new Error("Choix invalide");
      }

      room.round.guesses[payload.playerId] = payload.question;

      if (allPlayersSubmitted(room, "guesses")) {
        const correct = room.round.question;
        room.players = room.players.map((p) => {
          if (room.round!.guesses[p.id] === correct) {
            return { ...p, score: p.score + 1 };
          }
          return p;
        });
        room.phase = "round-end";
      }

      await saveRoom(room);
      return room;
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

export async function getRoomState(code: string): Promise<RoomState> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    throw new Error("Code de salon invalide");
  }
  const room = await getRoom(normalized);
  if (!room) throw new Error("Salon introuvable");

  const timed = applyRankingTimeout(room);
  if (timed !== room) {
    await saveRoom(timed);
    return timed;
  }
  return room;
}

export async function getRoomMeta(code: string): Promise<{ exists: boolean }> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    return { exists: false };
  }
  const room = await getRoom(normalized);
  return { exists: room !== null };
}
