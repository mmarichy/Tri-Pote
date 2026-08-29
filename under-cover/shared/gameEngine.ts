import type {
  Player,
  Role,
  RoomSettings,
  RoomState,
  RoomView,
  Winner,
  WordPair,
} from "./types";
import { pickRandomWordPair } from "./wordPairs";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getAlivePlayers(room: RoomState): Player[] {
  return room.players.filter((player) => player.isAlive);
}

export function countRoles(roles: Record<string, Role>): Record<Role, number> {
  return Object.values(roles).reduce(
    (acc, role) => {
      acc[role] += 1;
      return acc;
    },
    { civilian: 0, undercover: 0, mrwhite: 0 }
  );
}

export function distributeRoles(
  players: Player[],
  settings: RoomSettings,
  wordPair: WordPair
): Record<string, Role> {
  const alive = players.filter((player) => player.isAlive);
  if (alive.length < settings.minPlayers) {
    throw new Error(`Il faut au moins ${settings.minPlayers} joueurs`);
  }

  const shuffled = shuffle(alive);
  const roles: Record<string, Role> = {};

  roles[shuffled[0].id] = "undercover";

  let index = 1;
  if (settings.includeMrWhite && alive.length >= 4 && shuffled[index]) {
    roles[shuffled[index].id] = "mrwhite";
    index += 1;
  }

  for (; index < shuffled.length; index++) {
    roles[shuffled[index].id] = "civilian";
  }

  if (!wordPair.civilian || !wordPair.undercover) {
    throw new Error("Paire de mots invalide");
  }

  return roles;
}

export function getPlayerWord(
  role: Role,
  wordPair: WordPair
): string | null {
  if (role === "civilian") return wordPair.civilian;
  if (role === "undercover") return wordPair.undercover;
  return null;
}

export function initializeSpeakingOrder(room: RoomState): string[] {
  return shuffle(getAlivePlayers(room).map((player) => player.id));
}

export function currentSpeakerId(room: RoomState): string | null {
  if (room.speakingOrder.length === 0) return null;
  return room.speakingOrder[room.currentSpeakerIndex] ?? null;
}

export function allPlayersAckedReveal(room: RoomState): boolean {
  const alive = getAlivePlayers(room);
  return alive.every((player) => room.revealAcks[player.id] === true);
}

export function allCluesSubmitted(room: RoomState): boolean {
  const alive = getAlivePlayers(room);
  return alive.every((player) => Boolean(room.clues[player.id]?.trim()));
}

export function allVotesSubmitted(room: RoomState): boolean {
  const alive = getAlivePlayers(room);
  return alive.every((player) => Boolean(room.votes[player.id]));
}

export function tallyVotes(
  room: RoomState
): { eliminatedId: string | null; tally: Record<string, number> } {
  const tally: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
  }

  let maxVotes = 0;
  let eliminatedId: string | null = null;
  let tie = false;

  for (const [playerId, votes] of Object.entries(tally)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      eliminatedId = playerId;
      tie = false;
    } else if (votes === maxVotes && votes > 0) {
      tie = true;
    }
  }

  if (tie || !eliminatedId) {
    return { eliminatedId: null, tally };
  }

  return { eliminatedId, tally };
}

export function checkWinCondition(room: RoomState): Winner | null {
  const alive = getAlivePlayers(room);
  const roles = countRoles(
    Object.fromEntries(
      alive.map((player) => [player.id, room.roles[player.id]])
    )
  );

  if (roles.undercover === 0) {
    return "civilians";
  }

  const evilCount = roles.undercover + roles.mrwhite;
  const goodCount = roles.civilian;

  if (evilCount >= goodCount && roles.undercover > 0) {
    return "undercover";
  }

  if (alive.length <= 2 && roles.undercover > 0) {
    return "undercover";
  }

  return null;
}

export function startGame(room: RoomState, usedWordIds: string[] = []): RoomState {
  const wordPair = pickRandomWordPair(usedWordIds);
  const roles = distributeRoles(room.players, room.settings, wordPair);
  const speakingOrder = initializeSpeakingOrder(room);

  return {
    ...room,
    phase: "reveal",
    round: 1,
    wordPair,
    roles,
    speakingOrder,
    currentSpeakerIndex: 0,
    clues: {},
    revealAcks: {},
    votes: {},
    eliminatedThisRound: null,
    lastEliminated: null,
    winner: null,
    updatedAt: Date.now(),
  };
}

export function advanceAfterReveal(room: RoomState): RoomState {
  return {
    ...room,
    phase: "speaking",
    updatedAt: Date.now(),
  };
}

export function submitClue(
  room: RoomState,
  playerId: string,
  clue: string
): RoomState {
  const trimmed = clue.trim();
  if (!trimmed) {
    throw new Error("Indice vide");
  }

  const speakerId = currentSpeakerId(room);
  if (speakerId !== playerId) {
    throw new Error("Ce n'est pas ton tour");
  }

  const nextClues = { ...room.clues, [playerId]: trimmed };
  const nextIndex = room.currentSpeakerIndex + 1;
  const speakingDone = nextIndex >= room.speakingOrder.length;

  return {
    ...room,
    clues: nextClues,
    currentSpeakerIndex: speakingDone
      ? room.currentSpeakerIndex
      : nextIndex,
    phase: speakingDone ? "debate" : "speaking",
    updatedAt: Date.now(),
  };
}

export function advanceDebate(room: RoomState): RoomState {
  return {
    ...room,
    phase: "vote",
    votes: {},
    updatedAt: Date.now(),
  };
}

export function applyVote(
  room: RoomState,
  voterId: string,
  targetId: string
): RoomState {
  const aliveIds = new Set(getAlivePlayers(room).map((player) => player.id));
  if (!aliveIds.has(voterId) || !aliveIds.has(targetId)) {
    throw new Error("Joueur invalide");
  }
  if (voterId === targetId) {
    throw new Error("Tu ne peux pas voter pour toi-même");
  }

  const votes = { ...room.votes, [voterId]: targetId };
  const nextRoom: RoomState = { ...room, votes, updatedAt: Date.now() };

  if (!allVotesSubmitted(nextRoom)) {
    return nextRoom;
  }

  return resolveVoteRound(nextRoom);
}

export function resolveVoteRound(room: RoomState): RoomState {
  const { eliminatedId } = tallyVotes(room);

  if (!eliminatedId) {
    return {
      ...room,
      phase: "round-end",
      eliminatedThisRound: null,
      updatedAt: Date.now(),
    };
  }

  const eliminatedRole = room.roles[eliminatedId];
  const players = room.players.map((player) =>
    player.id === eliminatedId ? { ...player, isAlive: false } : player
  );

  const nextRoom: RoomState = {
    ...room,
    players,
    phase: "round-end",
    eliminatedThisRound: eliminatedId,
    lastEliminated: { playerId: eliminatedId, role: eliminatedRole },
    updatedAt: Date.now(),
  };

  const winner = checkWinCondition(nextRoom);
  if (winner) {
    return {
      ...nextRoom,
      phase: "game-end",
      winner,
    };
  }

  return nextRoom;
}

export function prepareNextRound(room: RoomState): RoomState {
  const speakingOrder = initializeSpeakingOrder(room);

  return {
    ...room,
    phase: "speaking",
    round: room.round + 1,
    speakingOrder,
    currentSpeakerIndex: 0,
    clues: {},
    votes: {},
    revealAcks: {},
    eliminatedThisRound: null,
    updatedAt: Date.now(),
  };
}

export function toRoomView(room: RoomState, playerId?: string): RoomView {
  const {
    wordPair: _wordPair,
    roles: _roles,
    lastEliminated,
    ...publicState
  } = room;

  const view: RoomView = {
    ...publicState,
    lastEliminated: null,
  };

  if (lastEliminated) {
    view.lastEliminated =
      room.phase === "game-end"
        ? lastEliminated
        : { playerId: lastEliminated.playerId };
  } else {
    view.lastEliminated = null;
  }

  if (playerId && room.roles[playerId] && room.wordPair && room.phase !== "lobby") {
    view.me = {
      word: getPlayerWord(room.roles[playerId], room.wordPair),
    };
  }

  if (room.phase === "game-end") {
    view.revealedRoles = { ...room.roles };
  }

  return view;
}
