import { useState } from "react";
import type { Role, RoomAction, RoomView, RoomState } from "../../shared/types";
import { currentSpeakerId } from "../../shared/gameEngine";

const ROLE_LABELS: Record<Role, string> = {
  civilian: "Civil",
  undercover: "Undercover",
  mrwhite: "Mr. White",
};

const WINNER_LABELS = {
  civilians: "Les Civils gagnent !",
  undercover: "L'Undercover gagne !",
  mrwhite: "Mr. White gagne !",
};

interface GameLoopProps {
  room: RoomView;
  playerId: string;
  isHost: boolean;
  dispatch: (action: RoomAction) => Promise<RoomView | undefined>;
  onLeave: () => void;
}

function RevealView({
  room,
  playerId,
  onAck,
}: {
  room: RoomView;
  playerId: string;
  onAck: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const me = room.me;
  const acked = room.revealAcks[playerId] === true;
  const ackCount = Object.values(room.revealAcks).filter(Boolean).length;
  const aliveCount = room.players.filter((player) => player.isAlive).length;

  if (!me) {
    return <p className="uc-error">Mot secret indisponible</p>;
  }

  return (
    <div className="space-y-4">
      <div className="uc-card border-undercover-accent/40 text-center">
        <p className="text-sm uppercase tracking-wider text-undercover-accent">
          Mot secret
        </p>

        {me.word ? (
          <div className="mt-6 rounded-xl bg-undercover-surface p-6">
            <p className="mt-2 font-display text-4xl font-bold text-white">
              {me.word}
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl bg-undercover-surface p-6">
            <p className="text-3xl">🤫</p>
            <p className="mt-2 text-undercover-muted">
              Tu n&apos;as pas de mot — improvise !
            </p>
          </div>
        )}

        <p className="uc-hint mt-4">
          Ne montre pas ton écran aux autres joueurs.
        </p>
      </div>

      <p className="uc-hint text-center">
        {ackCount}/{aliveCount} joueurs prêts
      </p>

      {error && <p className="uc-error">{error}</p>}

      {!acked ? (
        <button
          className="uc-btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onAck();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          J&apos;ai compris — ne pas montrer
        </button>
      ) : (
        <div className="uc-card text-center text-undercover-muted">
          En attente des autres joueurs...
        </div>
      )}
    </div>
  );
}

function SpeakingView({
  room,
  playerId,
  onSubmitClue,
}: {
  room: RoomView;
  playerId: string;
  onSubmitClue: (clue: string) => Promise<void>;
}) {
  const [clue, setClue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speakerId = currentSpeakerId(room as RoomState);
  const speaker = room.players.find((player) => player.id === speakerId);
  const isMyTurn = speakerId === playerId;
  const myClue = room.clues[playerId];

  if (myClue) {
    return (
      <div className="space-y-4">
        <div className="uc-card text-center">
          <p className="text-sm text-undercover-muted">Ton indice</p>
          <p className="mt-2 text-xl font-semibold">&laquo; {myClue} &raquo;</p>
        </div>
        <div className="uc-card text-center text-undercover-muted">
          En attente des autres joueurs...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="uc-card">
        <p className="text-sm text-undercover-accent">
          Manche {room.round} — Tour de parole
        </p>
        <h2 className="mt-2 font-display text-xl font-bold">
          {isMyTurn ? "À ton tour !" : `Tour de ${speaker?.name ?? "..."}`}
        </h2>
        <p className="mt-2 uc-hint">
          Donne un indice sur ton mot sans le révéler directement.
        </p>
      </div>

      {isMyTurn && (
        <>
          <input
            className="uc-input"
            type="text"
            placeholder="Ton indice en un mot ou une phrase..."
            value={clue}
            maxLength={80}
            onChange={(event) => setClue(event.target.value)}
          />
          {error && <p className="uc-error">{error}</p>}
          <button
            className="uc-btn-primary"
            type="button"
            disabled={busy || !clue.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onSubmitClue(clue);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer mon indice
          </button>
        </>
      )}
    </div>
  );
}

function DebateView({
  room,
  isHost,
  onAdvance,
}: {
  room: RoomView;
  isHost: boolean;
  onAdvance: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="space-y-4">
      <div className="uc-card">
        <h2 className="font-display text-xl font-bold">Phase de débat</h2>
        <p className="mt-2 uc-hint">
          Discutez entre vous, posez des questions et essayez de démasquer
          l&apos;Undercover.
        </p>
      </div>

      <div className="uc-card">
        <h3 className="mb-3 font-semibold">Indices donnés</h3>
        <ul className="space-y-2">
          {room.players
            .filter((player) => player.isAlive && room.clues[player.id])
            .map((player) => (
              <li
                key={player.id}
                className="rounded-lg bg-undercover-surface px-3 py-2 text-sm"
              >
                <span className="font-medium">{player.name}</span>
                <span className="text-undercover-muted">
                  {" "}
                  — &laquo; {room.clues[player.id]} &raquo;
                </span>
              </li>
            ))}
        </ul>
      </div>

      {error && <p className="uc-error">{error}</p>}

      {isHost ? (
        <button
          className="uc-btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onAdvance();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          Passer au vote
        </button>
      ) : (
        <div className="uc-card text-center text-undercover-muted">
          L&apos;hôte lancera le vote quand le débat est terminé...
        </div>
      )}
    </div>
  );
}

function VoteView({
  room,
  playerId,
  onVote,
}: {
  room: RoomView;
  playerId: string;
  onVote: (targetId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasVoted = Boolean(room.votes[playerId]);
  const voteCount = Object.keys(room.votes).length;
  const aliveCount = room.players.filter((player) => player.isAlive).length;

  if (hasVoted) {
    return (
      <div className="space-y-4">
        <div className="uc-card text-center">
          <p className="text-2xl">🗳️</p>
          <p className="mt-2 font-semibold">Vote enregistré</p>
          <p className="uc-hint mt-1">
            {voteCount}/{aliveCount} votes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="uc-card">
        <h2 className="font-display text-xl font-bold">Vote d&apos;élimination</h2>
        <p className="mt-2 uc-hint">
          Choisis le joueur que tu veux éliminer.
        </p>
      </div>

      <div className="space-y-2">
        {room.players
          .filter((player) => player.isAlive && player.id !== playerId)
          .map((player) => (
            <button
              key={player.id}
              className="uc-btn-secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onVote(player.id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {player.name}
            </button>
          ))}
      </div>

      {error && <p className="uc-error">{error}</p>}
    </div>
  );
}

function RoundEndView({
  room,
  isHost,
  onNext,
}: {
  room: RoomView;
  isHost: boolean;
  onNext: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const eliminated = room.lastEliminated
    ? room.players.find((player) => player.id === room.lastEliminated?.playerId)
    : null;

  return (
    <div className="space-y-4">
      <div className="uc-card text-center">
        {room.eliminatedThisRound && eliminated ? (
          <>
            <p className="text-sm text-undercover-muted">Éliminé</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-red-400">
              {eliminated.name}
            </h2>
            <p className="uc-hint mt-2">
              Le rôle sera révélé à la fin de la partie.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">Égalité !</h2>
            <p className="mt-2 uc-hint">Personne n&apos;est éliminé cette manche.</p>
          </>
        )}
      </div>

      <div className="uc-card">
        <h3 className="mb-3 font-semibold">Joueurs restants</h3>
        <ul className="space-y-2">
          {room.players
            .filter((player) => player.isAlive)
            .map((player) => (
              <li
                key={player.id}
                className="rounded-lg bg-undercover-surface px-3 py-2"
              >
                {player.name}
              </li>
            ))}
        </ul>
      </div>

      {isHost ? (
        <button
          className="uc-btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onNext();
            } finally {
              setBusy(false);
            }
          }}
        >
          Manche suivante
        </button>
      ) : (
        <div className="uc-card text-center text-undercover-muted">
          En attente de l&apos;hôte...
        </div>
      )}
    </div>
  );
}

function GameEndView({
  room,
  isHost,
  onRestart,
  onLeave,
}: {
  room: RoomView;
  isHost: boolean;
  onRestart: () => Promise<void>;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="uc-card border-undercover-accent/40 text-center">
        <p className="text-4xl">🏆</p>
        <h2 className="mt-3 font-display text-2xl font-bold">
          {room.winner ? WINNER_LABELS[room.winner] : "Partie terminée"}
        </h2>
      </div>

      <div className="uc-card">
        <h3 className="mb-3 font-semibold">Rôles révélés</h3>
        <ul className="space-y-2">
          {room.players.map((player) => {
            const role = room.revealedRoles?.[player.id];
            return (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg bg-undercover-surface px-3 py-2"
              >
                <span>
                  {player.name}
                  {!player.isAlive && (
                    <span className="ml-2 text-xs text-undercover-muted">
                      (éliminé)
                    </span>
                  )}
                </span>
                <span className="font-medium text-undercover-accent">
                  {role ? ROLE_LABELS[role] : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {isHost && (
        <button
          className="uc-btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRestart();
            } finally {
              setBusy(false);
            }
          }}
        >
          Nouvelle partie
        </button>
      )}

      <button className="uc-btn-ghost" type="button" onClick={onLeave}>
        Quitter
      </button>
    </div>
  );
}

export function GameLoop({ room, playerId, isHost, dispatch, onLeave }: GameLoopProps) {
  switch (room.phase) {
    case "reveal":
      return (
        <RevealView
          room={room}
          playerId={playerId}
          onAck={async () => {
            await dispatch({ action: "ack-reveal", playerId });
          }}
        />
      );

    case "speaking":
      return (
        <SpeakingView
          room={room}
          playerId={playerId}
          onSubmitClue={async (clue) => {
            await dispatch({ action: "submit-clue", playerId, clue });
          }}
        />
      );

    case "debate":
      return (
        <DebateView
          room={room}
          isHost={isHost}
          onAdvance={async () => {
            await dispatch({ action: "advance-debate", playerId });
          }}
        />
      );

    case "vote":
      return (
        <VoteView
          room={room}
          playerId={playerId}
          onVote={async (targetId) => {
            await dispatch({ action: "vote", playerId, targetId });
          }}
        />
      );

    case "round-end":
      return (
        <RoundEndView
          room={room}
          isHost={isHost}
          onNext={async () => {
            await dispatch({ action: "next-round", playerId });
          }}
        />
      );

    case "game-end":
      return (
        <GameEndView
          room={room}
          isHost={isHost}
          onRestart={async () => {
            await dispatch({ action: "restart", playerId });
          }}
          onLeave={onLeave}
        />
      );

    default:
      return null;
  }
}
