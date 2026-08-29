import { createId, generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../../../under-cover/shared/roomCode.js";
import {
  advanceAfterReveal,
  advanceDebate,
  allPlayersAckedReveal,
  applyVote,
  prepareNextRound,
  startGame,
  submitClue,
  toRoomView,
} from "../../../under-cover/shared/gameEngine.js";
import type { RoomAction, RoomState, RoomView } from "../../../under-cover/shared/types.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "../../../under-cover/shared/types.js";
import {
  deleteRoom,
  getPresenceMap,
  getRoom,
  markLeft,
  roomExists,
  saveRoom,
  touchPresence,
} from "./store.js";

const PLAYER_INACTIVE_MS = 90_000;

function assertHost(room: RoomState, playerId: string): void {
  if (room.hostId !== playerId) {
    throw new Error("Action réservée à l'hôte");
  }
}

function assertInRoom(room: RoomState, playerId: string): void {
  if (!room.players.some((player) => player.id === playerId)) {
    throw new Error("Joueur introuvable dans ce salon");
  }
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    if (!(await roomExists(code))) return code;
  }
  throw new Error("Impossible de générer un code unique");
}

export async function createRoom(hostName: string): Promise<{
  room: RoomView;
  playerId: string;
}> {
  const hostId = createId();
  const code = await generateUniqueCode();
  const now = Date.now();

  const room: RoomState = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName.trim(), isAlive: true }],
    phase: "lobby",
    settings: { includeMrWhite: true, minPlayers: MIN_PLAYERS },
    round: 0,
    wordPair: null,
    roles: {},
    speakingOrder: [],
    currentSpeakerIndex: 0,
    clues: {},
    revealAcks: {},
    votes: {},
    eliminatedThisRound: null,
    lastEliminated: null,
    winner: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveRoom(room);
  await touchPresence(code, hostId);
  return { room: toRoomView(room, hostId), playerId: hostId };
}

async function purgeInactivePlayers(room: RoomState): Promise<RoomState> {
  if (room.phase !== "lobby") return room;

  const presence = await getPresenceMap(
    room.code,
    room.players.map((player) => player.id)
  );
  const now = Date.now();
  const activePlayers = room.players.filter((player) => {
    const lastSeen = presence[player.id];
    if (lastSeen === 0) return false;
    if (lastSeen === undefined) return true;
    return now - lastSeen < PLAYER_INACTIVE_MS;
  });

  if (activePlayers.length === room.players.length) return room;

  let hostId = room.hostId;
  if (!activePlayers.some((player) => player.id === hostId)) {
    hostId = activePlayers[0]?.id ?? hostId;
  }

  return {
    ...room,
    hostId,
    players: activePlayers,
    updatedAt: Date.now(),
  };
}

export async function getRoomMeta(code: string): Promise<{ exists: boolean }> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return { exists: false };
  return { exists: await roomExists(normalized) };
}

export async function getRoomState(
  code: string,
  playerId?: string
): Promise<RoomView> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    throw new Error("Code invalide");
  }

  let room = await getRoom(normalized);
  if (!room) throw new Error("Partie introuvable");

  if (playerId) {
    assertInRoom(room, playerId);
    await touchPresence(normalized, playerId);
    room = await purgeInactivePlayers(room);
    await saveRoom(room);
  }

  return toRoomView(room, playerId);
}

export async function handleAction(
  code: string,
  action: RoomAction
): Promise<RoomView> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) {
    throw new Error("Code invalide");
  }

  let room = await getRoom(normalized);
  if (!room) throw new Error("Partie introuvable");

  switch (action.action) {
    case "join": {
      const name = action.name.trim();
      if (!name) throw new Error("Nom requis");
      if (room.phase !== "lobby") {
        throw new Error("La partie a déjà commencé");
      }
      if (room.players.length >= MAX_PLAYERS) {
        throw new Error("Salon complet");
      }
      const duplicate = room.players.some(
        (player) => player.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) throw new Error("Ce pseudo est déjà pris");

      const playerId = createId();
      room = {
        ...room,
        players: [...room.players, { id: playerId, name, isAlive: true }],
        updatedAt: Date.now(),
      };
      await saveRoom(room);
      await touchPresence(normalized, playerId);
      return toRoomView(room, playerId);
    }

    case "leave": {
      assertInRoom(room, action.playerId);
      await markLeft(normalized, action.playerId);
      const remaining = room.players.filter(
        (player) => player.id !== action.playerId
      );

      if (remaining.length === 0) {
        await deleteRoom(normalized);
        throw new Error("Salon fermé");
      }

      let hostId = room.hostId;
      if (hostId === action.playerId) {
        hostId = remaining[0].id;
      }

      room = {
        ...room,
        hostId,
        players: remaining,
        updatedAt: Date.now(),
      };
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "kick": {
      assertHost(room, action.playerId);
      if (action.targetId === action.playerId) {
        throw new Error("Tu ne peux pas t'expulser");
      }
      if (room.phase !== "lobby") {
        throw new Error("Impossible d'expulser en cours de partie");
      }

      await markLeft(normalized, action.targetId);
      room = {
        ...room,
        players: room.players.filter(
          (player) => player.id !== action.targetId
        ),
        updatedAt: Date.now(),
      };
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "set-settings": {
      assertHost(room, action.playerId);
      if (room.phase !== "lobby") {
        throw new Error("Paramètres verrouillés");
      }
      room = {
        ...room,
        settings: {
          ...room.settings,
          includeMrWhite: action.includeMrWhite,
        },
        updatedAt: Date.now(),
      };
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "start": {
      assertHost(room, action.playerId);
      if (room.players.length < room.settings.minPlayers) {
        throw new Error(
          `Il faut au moins ${room.settings.minPlayers} joueurs`
        );
      }
      room = startGame(room);
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "ack-reveal": {
      assertInRoom(room, action.playerId);
      if (room.phase !== "reveal") {
        throw new Error("Phase invalide");
      }
      room = {
        ...room,
        revealAcks: { ...room.revealAcks, [action.playerId]: true },
        updatedAt: Date.now(),
      };
      if (allPlayersAckedReveal(room)) {
        room = advanceAfterReveal(room);
      }
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "submit-clue": {
      assertInRoom(room, action.playerId);
      if (room.phase !== "speaking") {
        throw new Error("Ce n'est pas la phase des indices");
      }
      room = submitClue(room, action.playerId, action.clue);
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "advance-debate": {
      assertHost(room, action.playerId);
      if (room.phase !== "debate") {
        throw new Error("Ce n'est pas la phase de débat");
      }
      room = advanceDebate(room);
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "vote": {
      assertInRoom(room, action.playerId);
      if (room.phase !== "vote") {
        throw new Error("Ce n'est pas la phase de vote");
      }
      room = applyVote(room, action.playerId, action.targetId);
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "next-round": {
      assertHost(room, action.playerId);
      if (room.phase !== "round-end") {
        throw new Error("Manche non terminée");
      }
      if (room.eliminatedThisRound === null) {
        room = prepareNextRound(room);
      } else {
        room = prepareNextRound(room);
      }
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    case "restart": {
      assertHost(room, action.playerId);
      const now = Date.now();
      room = {
        code: room.code,
        hostId: room.hostId,
        players: room.players.map((player) => ({
          ...player,
          isAlive: true,
        })),
        phase: "lobby",
        settings: room.settings,
        round: 0,
        wordPair: null,
        roles: {},
        speakingOrder: [],
        currentSpeakerIndex: 0,
        clues: {},
        revealAcks: {},
        votes: {},
        eliminatedThisRound: null,
        lastEliminated: null,
        winner: null,
        createdAt: room.createdAt,
        updatedAt: now,
      };
      await saveRoom(room);
      return toRoomView(room, action.playerId);
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Action inconnue: ${(_exhaustive as RoomAction).action}`);
    }
  }
}
