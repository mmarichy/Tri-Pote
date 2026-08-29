import questionsData from "./questions.json";
import {
  buildChoices,
  createId,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  pickQuestion,
} from "./game";
import type { Player, RoomAction, RoomState } from "./types";
import { getRoom, roomExists, saveRoom } from "./store";

const QUESTIONS: string[] = questionsData.questions;

function assertQuestions() {
  if (QUESTIONS.length < 4) {
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

function startRound(room: RoomState): RoomState {
  const question = pickQuestion(QUESTIONS, room.usedQuestions);
  if (!question) {
    return { ...room, phase: "game-end", round: null };
  }

  const { choices } = buildChoices(question, QUESTIONS);

  return {
    ...room,
    phase: "ranking",
    usedQuestions: [...room.usedQuestions, question],
    round: {
      question,
      choices,
      rankings: {},
      guesses: {},
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

  const room = await getRoom(normalized);
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
      room.players.push({ id: createId(), name, score: 0 });
      await saveRoom(room);
      return room;
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
