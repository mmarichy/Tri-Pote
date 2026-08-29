import { useEffect, useState } from "react";
import {
  clearSession,
  createRoom,
  fetchRoomMeta,
  loadSession,
  saveSession,
  sendAction,
} from "./api/client";
import {
  aggregateRankings,
  countCompletedGuesses,
  countCompletedRankings,
  getTopPlayerForQuestion,
  nextPendingIndex,
  normalizeRoomCode,
  rankingsForQuestion,
} from "../shared/game";
import { useRoom } from "./hooks/useRoom";
import type { Player, RoomState, Session } from "./types";
import { clearRoomUrl, getRoomCodeFromUrl, redirectQueryRoomToPath, roomUrl, setRoomUrl } from "./url";

function RoomCodeBanner({ code }: { code: string }) {
  const link = roomUrl(code);

  const copyCode = () => navigator.clipboard.writeText(code);
  const copyLink = () => navigator.clipboard.writeText(link);

  return (
    <div className="room-code">
      <p className="room-code-label">Salon privé — code unique</p>
      <p className="room-code-value">{code}</p>
      <div className="room-code-actions">
        <button className="btn btn-secondary btn-sm" type="button" onClick={copyCode}>
          Copier le code
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={copyLink}>
          Copier le lien
        </button>
      </div>
      <p className="hint">
        Partage ce code à tes potes pour qu'ils rejoignent le salon.
      </p>
    </div>
  );
}

function HomeScreen({
  onSession,
  initialCode,
}: {
  onSession: (s: Session, room?: RoomState) => void;
  initialCode?: string;
}) {
  const [mode, setMode] = useState<"create" | "join">(
    initialCode ? "join" : "create"
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [codeChecked, setCodeChecked] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "join") return;

    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 4) {
      setCodeChecked(null);
      return;
    }

    setCodeChecked(null);
    let active = true;
    fetchRoomMeta(normalized).then((meta) => {
      if (!active) return;
      setCodeChecked(meta.exists);
    });

    return () => {
      active = false;
    };
  }, [code, mode]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { room, playerId } = await createRoom(name);
      const session = { roomCode: room.code, playerId };
      saveSession(session);
      onSession(session, room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const normalized = normalizeRoomCode(code);
    if (!name.trim() || normalized.length !== 4) return;
    setBusy(true);
    setError("");
    try {
      const room = await sendAction(normalized, {
        action: "join",
        name,
      });
      const me = room.players.find(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (!me) throw new Error("Joueur introuvable");
      const session = { roomCode: room.code, playerId: me.id };
      saveSession(session);
      onSession(session, room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mode-tabs">
        <button
          type="button"
          className={`mode-tab ${mode === "create" ? "active" : ""}`}
          onClick={() => setMode("create")}
        >
          Créer un salon
        </button>
        <button
          type="button"
          className={`mode-tab ${mode === "join" ? "active" : ""}`}
          onClick={() => setMode("join")}
        >
          Rejoindre
        </button>
      </div>

      <div className="card">
        <label htmlFor="name">Ton pseudo</label>
        <input
          id="name"
          type="text"
          placeholder="Prénom..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {mode === "create" && (
          <p className="hint hint--compact">
            Un code unique à 4 caractères sera généré automatiquement.
          </p>
        )}

        {mode === "join" && (
          <>
            <label htmlFor="code">Code du salon</label>
            <div className="code-input-wrap">
              <input
                id="code"
                type="text"
                className="code-input"
                placeholder="• • • •"
                value={code}
                onChange={(e) =>
                  setCode(normalizeRoomCode(e.target.value).slice(0, 4))
                }
                maxLength={4}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <div className="code-slots" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span
                    key={i}
                    className={`code-slot ${code[i] ? "filled" : ""} ${code[i] && i === code.length - 1 ? "active" : ""}`}
                  >
                    {code[i] ?? ""}
                  </span>
                ))}
              </div>
            </div>
            {code.length === 4 && codeChecked === false && (
              <p className="error">Salon introuvable — vérifie le code</p>
            )}
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-primary"
        type="button"
        disabled={
          busy ||
          !name.trim() ||
          (mode === "join" &&
            (normalizeRoomCode(code).length !== 4 || codeChecked !== true))
        }
        onClick={mode === "create" ? handleCreate : handleJoin}
      >
        {mode === "create" ? "Créer mon salon" : "Rejoindre"}
      </button>
    </>
  );
}

function LobbyScreen({
  room,
  playerId,
  isHost,
  onStart,
  onKick,
  onLeave,
}: {
  room: RoomState;
  playerId: string;
  isHost: boolean;
  onStart: (rounds: number) => Promise<void>;
  onKick: (targetId: string) => Promise<void>;
  onLeave: () => void;
}) {
  const [rounds, setRounds] = useState(room.totalRounds);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const handleStart = async () => {
    setBusy(true);
    setError("");
    try {
      await onStart(rounds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <RoomCodeBanner code={room.code} />

      <div className="card">
        <h2>Joueurs ({room.players.length})</h2>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id} className="player-chip">
              <span>
                {p.name}
                {p.id === room.hostId && " 👑"}
                {p.id === playerId && " (toi)"}
              </span>
              {isHost && p.id !== playerId && (
                <button
                  className="btn-kick"
                  type="button"
                  disabled={kickingId === p.id}
                  onClick={async () => {
                    setKickingId(p.id);
                    setError("");
                    try {
                      await onKick(p.id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur");
                    } finally {
                      setKickingId(null);
                    }
                  }}
                >
                  Expulser
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="card">
          <h2>Paramètres</h2>
          <label htmlFor="rounds">Nombre de manches</label>
          <input
            id="rounds"
            type="number"
            min={1}
            max={50}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
          {error && <p className="error">{error}</p>}
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || room.players.length < 2}
            onClick={handleStart}
          >
            Lancer la partie
          </button>
        </div>
      ) : (
        <div className="waiting-banner">
          <p>En attente que l'hôte lance la partie...</p>
        </div>
      )}

      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        Quitter la partie
      </button>
    </>
  );
}

function CountdownTimer({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now())
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 10;

  return (
    <div className={`timer ${urgent ? "timer-urgent" : ""}`}>
      ⏱ {seconds}s pour classer
    </div>
  );
}

function QuestionList({
  questions,
  activeIndex,
  completedIndices,
}: {
  questions: string[];
  activeIndex?: number;
  completedIndices?: Set<number>;
}) {
  return (
    <div className="question-list">
      {questions.map((q, i) => (
        <div
          key={i}
          className={`question-big ${activeIndex === i ? "active" : ""} ${completedIndices?.has(i) ? "done" : ""}`}
        >
          <span className="question-num">{i + 1}</span>
          <p>{q}</p>
        </div>
      ))}
    </div>
  );
}

function RankingScreen({
  room,
  playerId,
  onSubmit,
}: {
  room: RoomState;
  playerId: string;
  onSubmit: (questionIndex: number, order: string[]) => Promise<void>;
}) {
  const questions = room.round?.questions ?? [];
  const playerRankings = room.round?.rankings[playerId];
  const completed = new Set<number>();
  for (let i = 0; i < questions.length; i++) {
    if (playerRankings?.[String(i)]) completed.add(i);
  }

  const currentIndex =
    nextPendingIndex(playerRankings, questions.length) ?? questions.length - 1;
  const allDone = countCompletedRankings(playerRankings, questions.length) === questions.length;

  const [order, setOrder] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrder([]);
  }, [currentIndex, allDone]);

  const rankMap = new Map(order.map((id, i) => [id, i + 1]));

  const handlePick = (id: string) => {
    if (order.includes(id)) return;
    setOrder((prev) => [...prev, id]);
  };

  const handleSubmit = async () => {
    if (allDone || order.length !== room.players.length) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(currentIndex, order);
      setOrder([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (allDone) {
    const donePlayers = room.players.filter((p) =>
      countCompletedRankings(room.round?.rankings[p.id], questions.length) ===
      questions.length
    ).length;
    return (
      <div className="waiting-banner">
        <div className="emoji">✅</div>
        <p>Tous tes classements sont envoyés !</p>
        <QuestionList questions={questions} completedIndices={completed} />
        <p className="hint">
          En attente des autres ({donePlayers}/{room.players.length})...
        </p>
      </div>
    );
  }

  return (
    <>
      {room.round?.rankingDeadline && (
        <CountdownTimer deadline={room.round.rankingDeadline} />
      )}

      <QuestionList
        questions={questions}
        activeIndex={currentIndex}
        completedIndices={completed}
      />

      <div className="card">
        <h2>
          Classe les joueurs — question {currentIndex + 1}/{questions.length}
        </h2>
        <p className="hint">
          Tape du <strong>plus voté</strong> au <strong>moins voté</strong>. (
          {order.length}/{room.players.length})
        </p>

        <div className="ranking-pick">
          {room.players.map((p) => {
            const rank = rankMap.get(p.id);
            const picked = rank !== undefined;
            return (
              <button
                key={p.id}
                type="button"
                className="rank-btn"
                disabled={picked}
                onClick={() => handlePick(p.id)}
              >
                <span className={`rank-badge ${picked ? "" : "pending"}`}>
                  {picked ? rank : "?"}
                </span>
                {p.name}
                {p.id === playerId && " (toi)"}
              </button>
            );
          })}
        </div>

        {order.length > 0 && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setOrder((prev) => prev.slice(0, -1))}
          >
            Annuler le dernier choix
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <button
        className="btn btn-primary"
        type="button"
        disabled={busy || order.length !== room.players.length}
        onClick={handleSubmit}
      >
        Valider — question {currentIndex + 1}
      </button>
    </>
  );
}

function RevealScreen({
  room,
  isHost,
  onContinue,
}: {
  room: RoomState;
  isHost: boolean;
  onContinue: () => Promise<void>;
}) {
  const questions = room.round?.questions ?? [];
  const rankings = room.round?.rankings ?? {};
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    setBusy(true);
    try {
      await onContinue();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Résultats des votes</h2>
        <p className="hint">Voici le joueur le plus voté pour chaque question.</p>

        {questions.map((q, i) => {
          const topId = getTopPlayerForQuestion(room.players, rankings, i);
          const topName =
            room.players.find((p) => p.id === topId)?.name ?? "—";
          const results = aggregateRankings(
            room.players,
            rankingsForQuestion(rankings, i)
          );

          return (
            <div key={i} className="reveal-question-block">
              <p className="question-big-text">{q}</p>
              <p className="reveal-winner">
                🏆 <strong>{topName}</strong>
              </p>
              <ul className="result-list result-list-compact">
                {results.slice(0, 3).map((r) => (
                  <li key={r.playerId} className="result-item">
                    <span className="result-rank">{r.rank}</span>
                    <span className="result-name">{r.name}</span>
                    <span className="result-points">{r.points} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={handleContinue}
        >
          Devine les gagnants →
        </button>
      ) : (
        <div className="waiting-banner">
          <p>En attente de l'hôte...</p>
        </div>
      )}
    </>
  );
}

function GuessScreen({
  room,
  playerId,
  onGuess,
}: {
  room: RoomState;
  playerId: string;
  onGuess: (questionIndex: number, guessedPlayerId: string) => Promise<void>;
}) {
  const questions = room.round?.questions ?? [];
  const playerGuesses = room.round?.guesses[playerId];
  const completed = new Set<number>();
  for (let i = 0; i < questions.length; i++) {
    if (playerGuesses?.[String(i)]) completed.add(i);
  }

  const currentIndex =
    nextPendingIndex(playerGuesses, questions.length) ?? questions.length - 1;
  const allDone =
    countCompletedGuesses(playerGuesses, questions.length) === questions.length;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGuess = async (guessedPlayerId: string) => {
    if (allDone) return;
    setBusy(true);
    setError("");
    try {
      await onGuess(currentIndex, guessedPlayerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (allDone) {
    const donePlayers = room.players.filter(
      (p) =>
        countCompletedGuesses(room.round?.guesses[p.id], questions.length) ===
        questions.length
    ).length;
    return (
      <div className="waiting-banner">
        <div className="emoji">🤔</div>
        <p>Toutes tes réponses sont envoyées !</p>
        <QuestionList questions={questions} completedIndices={completed} />
        <p className="hint">
          En attente des autres ({donePlayers}/{room.players.length})...
        </p>
      </div>
    );
  }

  return (
    <>
      <QuestionList
        questions={questions}
        activeIndex={currentIndex}
        completedIndices={completed}
      />

      <div className="card">
        <h2>
          Qui a été le plus voté ? — question {currentIndex + 1}/
          {questions.length}
        </h2>
        <p className="hint">+1 point par bonne réponse.</p>

        <div className="ranking-pick">
          {room.players.map((p) => (
            <button
              key={p.id}
              type="button"
              className="guess-player-btn"
              disabled={busy}
              onClick={() => handleGuess(p.id)}
            >
              {p.name}
              {p.id === playerId && " (toi)"}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}

function RoundEndScreen({
  room,
  playerId,
  isHost,
  isLastRound,
  onNext,
}: {
  room: RoomState;
  playerId: string;
  isHost: boolean;
  isLastRound: boolean;
  onNext: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const questions = room.round?.questions ?? [];
  const rankings = room.round?.rankings ?? {};
  const myGuesses = room.round?.guesses[playerId] ?? {};

  return (
    <>
      <div className="card">
        <h2>Bilan de la manche</h2>
        {questions.map((q, i) => {
          const topId = getTopPlayerForQuestion(room.players, rankings, i);
          const topName = room.players.find((p) => p.id === topId)?.name ?? "—";
          const myGuess = myGuesses[String(i)];
          const myGuessName =
            room.players.find((p) => p.id === myGuess)?.name ?? "—";
          const correct = myGuess === topId;

          return (
            <div key={i} className="reveal-question-block">
              <p className="question-big-text">{q}</p>
              <p className="hint">
                Gagnant : <strong>{topName}</strong>
                {myGuess ? (
                  <>
                    {" "}
                    — Tu as dit : {myGuessName} {correct ? "✅ +1 pt" : "❌"}
                  </>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Scores</h2>
        <ul className="player-list">
          {[...room.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id} className="player-chip">
                <span>{p.name}</span>
                <span className="score">
                  {p.score} pt{p.score !== 1 ? "s" : ""}
                </span>
              </li>
            ))}
        </ul>
      </div>

      {isHost ? (
        <button
          className="btn btn-primary"
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
          {isLastRound ? "Voir le classement final" : "Manche suivante →"}
        </button>
      ) : (
        <div className="waiting-banner">
          <p>En attente de l'hôte...</p>
        </div>
      )}
    </>
  );
}

function GameEndScreen({
  players,
  isHost,
  onRestart,
  onLeave,
}: {
  players: Player[];
  isHost: boolean;
  onRestart: () => Promise<void>;
  onLeave: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const [busy, setBusy] = useState(false);

  return (
    <div className="scoreboard-final">
      <div className="winner">
        <span>🏆</span>
        {sorted[0]?.name ?? "—"}
      </div>

      <div className="card">
        <h3>Classement final</h3>
        <ul className="result-list">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`result-item ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}
            >
              <span className="result-rank">{i + 1}</span>
              <span className="result-name">{p.name}</span>
              <span className="result-points">
                {p.score} pt{p.score !== 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <button
          className="btn btn-primary"
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

      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        Quitter
      </button>
    </div>
  );
}

function GameScreen({
  session,
  initialRoom,
  onLeave,
}: {
  session: Session;
  initialRoom: RoomState | null;
  onLeave: () => void;
}) {
  const { room, error, loading, dispatch, leave } = useRoom(session, initialRoom);

  const handleLeave = async () => {
    await leave();
    onLeave();
  };

  if (loading && !room) {
    return <div className="loading">Connexion à la partie...</div>;
  }

  if (!room) {
    return (
      <>
        <p className="error">{error || "Partie introuvable"}</p>
        <button className="btn btn-primary" type="button" onClick={handleLeave}>
          Retour
        </button>
      </>
    );
  }

  const isHost = room.hostId === session.playerId;
  const isLastRound = room.currentRound >= room.totalRounds;

  return (
    <>
      {error && <p className="error">{error}</p>}

      {room.phase !== "lobby" && room.phase !== "game-end" && (
        <div className="round-info">
          <span>
            Manche <span className="highlight">{room.currentRound}</span> /{" "}
            {room.totalRounds}
          </span>
          <span className="room-pill">{room.code}</span>
        </div>
      )}

      {room.phase === "lobby" && (
        <LobbyScreen
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          onStart={async (totalRounds) => {
            await dispatch({
              action: "start",
              playerId: session.playerId,
              totalRounds,
            });
          }}
          onKick={async (targetId) => {
            await dispatch({
              action: "kick",
              playerId: session.playerId,
              targetId,
            });
          }}
          onLeave={handleLeave}
        />
      )}

      {room.phase === "ranking" && (
        <RankingScreen
          room={room}
          playerId={session.playerId}
          onSubmit={async (questionIndex, order) => {
            await dispatch({
              action: "rank",
              playerId: session.playerId,
              questionIndex,
              order,
            });
          }}
        />
      )}

      {room.phase === "reveal" && (
        <RevealScreen
          room={room}
          isHost={isHost}
          onContinue={async () => {
            await dispatch({ action: "continue", playerId: session.playerId });
          }}
        />
      )}

      {room.phase === "guess" && (
        <GuessScreen
          room={room}
          playerId={session.playerId}
          onGuess={async (questionIndex, guessedPlayerId) => {
            await dispatch({
              action: "guess",
              playerId: session.playerId,
              questionIndex,
              guessedPlayerId,
            });
          }}
        />
      )}

      {room.phase === "round-end" && (
        <RoundEndScreen
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          isLastRound={isLastRound}
          onNext={async () => {
            await dispatch({ action: "next-round", playerId: session.playerId });
          }}
        />
      )}

      {room.phase === "game-end" && (
        <GameEndScreen
          players={room.players}
          isHost={isHost}
          onRestart={async () => {
            await dispatch({ action: "restart", playerId: session.playerId });
          }}
          onLeave={handleLeave}
        />
      )}

      {room.phase !== "lobby" && room.phase !== "game-end" && (
        <button
          className="btn btn-ghost leave-btn"
          type="button"
          onClick={handleLeave}
        >
          Quitter la partie
        </button>
      )}
    </>
  );
}

export default function App() {
  redirectQueryRoomToPath();
  const joinCode = getRoomCodeFromUrl();

  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession();
    if (!saved) return null;
    if (joinCode && saved.roomCode !== joinCode) return null;
    return saved;
  });
  const [initialRoom, setInitialRoom] = useState<RoomState | null>(null);

  useEffect(() => {
    if (session) setRoomUrl(session.roomCode);
  }, [session]);

  const handleLeave = () => {
    clearSession();
    setSession(null);
    setInitialRoom(null);
    clearRoomUrl();
  };

  const handleSession = (s: Session, room?: RoomState) => {
    setSession(s);
    setInitialRoom(room ?? null);
    setRoomUrl(s.roomCode);
  };

  return (
    <div className="app">
      <h1>Tri-Pote</h1>
      <p className="subtitle">Salons privés entre potes — multijoueur</p>

      {session ? (
        <GameScreen
          session={session}
          initialRoom={initialRoom}
          onLeave={handleLeave}
        />
      ) : (
        <HomeScreen onSession={handleSession} initialCode={joinCode} />
      )}
    </div>
  );
}
