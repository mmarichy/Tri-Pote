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
  countCompletedGuesses,
  countCompletedRankings,
  nextPendingIndex,
  normalizeRoomCode,
} from "../shared/game";
import { DEFAULT_QUESTIONS_PER_ROUND, MAX_QUESTIONS_PER_ROUND } from "./types";
import { ALL_THEMES } from "../shared/themes";
import { useRoom } from "./hooks/useRoom";
import type { Player, RoomState, Session } from "./types";
import { clearRoomUrl, getRoomCodeFromUrl, redirectQueryRoomToPath, setRoomUrl } from "./url";

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GameTopBar({
  code,
  onLeave,
}: {
  code: string;
  onLeave: () => void | Promise<void>;
}) {
  const [codeVisible, setCodeVisible] = useState(true);

  return (
    <div className="game-top-bar-wrap">
      <div className="game-top-bar">
        <button className="btn btn-ghost btn-sm game-top-leave" type="button" onClick={onLeave}>
          Quitter la partie
        </button>
        <div className="game-top-code">
          <span className="game-top-code-value">
            {codeVisible ? code : "••••"}
          </span>
          <button
            type="button"
            className="btn-icon btn-icon-eye"
            aria-label={codeVisible ? "Masquer le code" : "Afficher le code"}
            aria-pressed={codeVisible}
            onClick={() => setCodeVisible((v) => !v)}
          >
            <IconEye open={codeVisible} />
          </button>
        </div>
      </div>
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

function ThemePicker({
  selectedThemes,
  isHost,
  onChange,
}: {
  selectedThemes: string[];
  isHost: boolean;
  onChange: (themes: string[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = new Set(selectedThemes);

  const applyThemes = async (themes: string[]) => {
    setBusy(true);
    setError("");
    try {
      await onChange(themes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (theme: string) => {
    if (!isHost || busy) return;
    if (selected.has(theme)) {
      void applyThemes(selectedThemes.filter((t) => t !== theme));
    } else {
      void applyThemes([...selectedThemes, theme]);
    }
  };

  return (
    <div className={`card theme-picker-panel ${isHost ? "" : "theme-picker-panel--readonly"}`}>
      <div className="theme-picker-header">
        <h2>Thèmes</h2>
        <span className="theme-picker-count">
          {selectedThemes.length}/{ALL_THEMES.length}
        </span>
      </div>
      {!isHost && (
        <span className="theme-readonly-badge">Lecture seule</span>
      )}
      <p className="hint hint--compact">
        {isHost
          ? "Sélectionne les thèmes — visible par tous en direct."
          : "L'hôte choisit les thèmes — tu vois la sélection en direct."}
      </p>
      {isHost && (
        <div className="theme-picker-actions">
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={busy || selectedThemes.length === ALL_THEMES.length}
            onClick={() => applyThemes([...ALL_THEMES])}
          >
            Tout sélectionner
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={busy || selectedThemes.length === 0}
            onClick={() => applyThemes([])}
          >
            Tout désélectionner
          </button>
        </div>
      )}
      <div className="theme-grid">
        {ALL_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            className={`theme-chip ${selected.has(theme) ? "active" : ""}`}
            disabled={!isHost || busy}
            onClick={() => toggle(theme)}
          >
            {theme}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function LobbyScreen({
  room,
  playerId,
  isHost,
  onStart,
  onSetThemes,
  onKick,
}: {
  room: RoomState;
  playerId: string;
  isHost: boolean;
  onStart: (rounds: number, questionsPerRound: number) => Promise<void>;
  onSetThemes: (themes: string[]) => Promise<void>;
  onKick: (targetId: string) => Promise<void>;
}) {
  const [rounds, setRounds] = useState(room.totalRounds);
  const [questionsPerRound, setQuestionsPerRound] = useState(
    room.questionsPerRound ?? DEFAULT_QUESTIONS_PER_ROUND
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const handleStart = async () => {
    setBusy(true);
    setError("");
    try {
      await onStart(rounds, questionsPerRound);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lobby-layout">
      <div className="lobby-main">
        <div className="card">
          <h2>Joueurs ({room.players.length})</h2>
          <ul className="player-list stagger-in">
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
            <label htmlFor="questions">Questions par manche</label>
            <input
              id="questions"
              type="number"
              min={1}
              max={MAX_QUESTIONS_PER_ROUND}
              value={questionsPerRound}
              onChange={(e) => setQuestionsPerRound(Number(e.target.value))}
            />
            <p className="hint hint--compact">
              Les questions s'affichent une par une. Tu passes à la suivante
              directement après ta réponse, puis tu attends les autres à la fin.
            </p>
            {error && <p className="error">{error}</p>}
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || room.players.length < 2 || (room.selectedThemes?.length ?? 0) === 0}
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

      </div>

      <aside className="lobby-sidebar" aria-label="Sélection des thèmes">
        <ThemePicker
          selectedThemes={room.selectedThemes ?? [...ALL_THEMES]}
          isHost={isHost}
          onChange={onSetThemes}
        />
      </aside>
    </div>
  );
}

function RoundIntroScreen({
  room,
  playerId,
  isHost,
  onBeginVotes,
}: {
  room: RoomState;
  playerId: string;
  isHost: boolean;
  onBeginVotes: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const questionCount = room.round?.questions.length ?? room.questionsPerRound;

  return (
    <>
      <div className="card card-highlight">
        <p className="phase-label">Manche {room.currentRound} / {room.totalRounds}</p>
        <h2 className="round-intro-title">Prêt pour les votes ?</h2>
        <p className="hint">
          Cette manche compte <strong>{questionCount} question{questionCount !== 1 ? "s" : ""}</strong>
          {room.selectedThemes?.length ? (
            <>
              {" "}
              — thèmes :{" "}
              <strong>{room.selectedThemes.length}</strong> sélectionné
              {room.selectedThemes.length !== 1 ? "s" : ""}
            </>
          ) : null}
          . Les questions restent secrètes jusqu'au lancement.
        </p>
      </div>

      <div className="card">
        <h2>Joueurs</h2>
        <ul className="player-list stagger-in">
          {[...room.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id} className="player-chip">
                <span>
                  {p.name}
                  {p.id === room.hostId && " 👑"}
                  {p.id === playerId && " (toi)"}
                </span>
                {room.currentRound > 1 && (
                  <span className="score">
                    {p.score} pt{p.score !== 1 ? "s" : ""}
                  </span>
                )}
              </li>
            ))}
        </ul>
      </div>

      <div className="card">
        <h2>Rappel</h2>
        <ul className="rules-list">
          <li>Phase 1 — Vote pour un joueur par question</li>
          <li>Pause — L'hôte lance la phase 2 quand tout le monde a voté</li>
          <li>Phase 2 — Devine qui a été le plus voté (+1 pt)</li>
          <li>Les questions s'enchaînent une par une à ton rythme</li>
        </ul>
      </div>

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onBeginVotes();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          Lancer les votes →
        </button>
      ) : (
        <div className="waiting-banner">
          <p>En attente que l'hôte lance les votes…</p>
        </div>
      )}
    </>
  );
}

function GuessIntroScreen({
  room,
  isHost,
  onBeginGuess,
}: {
  room: RoomState;
  isHost: boolean;
  onBeginGuess: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const questionCount = room.round?.questions.length ?? 0;
  const progress = room.round?.progress;

  return (
    <>
      <div className="card card-highlight">
        <p className="phase-label">Phase 1 terminée</p>
        <h2 className="round-intro-title">Prêt pour la devinette ?</h2>
        <p className="hint">
          Tout le monde a voté sur les <strong>{questionCount} question{questionCount !== 1 ? "s" : ""}</strong>.
          Place à la phase 2 : devine qui a été le plus voté (+1 pt par bonne réponse).
        </p>
      </div>

      <div className="card">
        <h2>Rappel phase 2</h2>
        <ul className="rules-list">
          <li>Les mêmes questions reviennent une par une</li>
          <li>Devine le joueur le plus voté par le groupe</li>
          <li>Les résultats seront révélés à la fin de la manche</li>
        </ul>
      </div>

      {progress && (
        <p className="hint hint--compact">
          Joueurs prêts : {progress.rankingsDone}/{progress.totalPlayers}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onBeginGuess();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          Lancer la devinette →
        </button>
      ) : (
        <div className="waiting-banner">
          <p>En attente que l'hôte lance la devinette…</p>
        </div>
      )}
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
      ⏱ {seconds}s pour répondre
    </div>
  );
}

function QuestionProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="question-progress" aria-label={`Question ${current + 1} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`question-progress-dot ${i < current ? "done" : ""} ${i === current ? "active" : ""}`}
        />
      ))}
    </div>
  );
}

function WaitingForOthers({
  emoji,
  message,
  done,
  total,
}: {
  emoji: string;
  message: string;
  done: number;
  total: number;
}) {
  return (
    <div className="waiting-banner">
      <div className="emoji">{emoji}</div>
      <p>{message}</p>
      <p className="hint">En attente que tout le monde ait terminé ({done}/{total})…</p>
    </div>
  );
}

function RankingScreen({
  room,
  playerId,
  onVote,
}: {
  room: RoomState;
  playerId: string;
  onVote: (questionIndex: number, votedPlayerId: string) => Promise<void>;
}) {
  const questions = room.round?.questions ?? [];
  const playerVotes = room.round?.rankings[playerId];
  const progress = room.round?.progress;
  const allDone =
    countCompletedRankings(playerVotes, questions.length) === questions.length;

  const currentIndex =
    nextPendingIndex(playerVotes, questions.length) ?? questions.length - 1;
  const currentQuestion = questions[currentIndex];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleVote = async (votedPlayerId: string) => {
    if (allDone || !currentQuestion) return;
    setBusy(true);
    setError("");
    try {
      await onVote(currentIndex, votedPlayerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (allDone) {
    return (
      <>
        <QuestionProgress current={questions.length} total={questions.length} />
        <WaitingForOthers
          emoji="✅"
          message="Tous tes votes sont envoyés !"
          done={progress?.rankingsDone ?? 0}
          total={progress?.totalPlayers ?? room.players.length}
        />
      </>
    );
  }

  return (
    <>
      {room.round?.rankingDeadline && (
        <CountdownTimer deadline={room.round.rankingDeadline} />
      )}

      <QuestionProgress current={currentIndex} total={questions.length} />

      <div className="card card-highlight">
        <p className="phase-label">
          Question {currentIndex + 1}/{questions.length}
        </p>
        <span className="theme-badge theme-badge-lg">{currentQuestion.theme}</span>
        <p className="question-hero">{currentQuestion.question}</p>
      </div>

      <div className="card">
        <h2>Qui choisis-tu ?</h2>
        <p className="hint">
          Tape sur <strong>un joueur</strong> — celui qui correspond le mieux à la question.
        </p>

        <div className="ranking-pick stagger-in">
          {room.players.map((p) => (
            <button
              key={p.id}
              type="button"
              className="guess-player-btn"
              disabled={busy}
              onClick={() => handleVote(p.id)}
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
  const progress = room.round?.progress;
  const allDone =
    countCompletedGuesses(playerGuesses, questions.length) === questions.length;

  const currentIndex =
    nextPendingIndex(playerGuesses, questions.length) ?? questions.length - 1;
  const currentQuestion = questions[currentIndex];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGuess = async (guessedPlayerId: string) => {
    if (allDone || !currentQuestion) return;
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
    return (
      <>
        <QuestionProgress current={questions.length} total={questions.length} />
        <WaitingForOthers
          emoji="🤔"
          message="Toutes tes réponses sont envoyées !"
          done={progress?.guessesDone ?? 0}
          total={progress?.totalPlayers ?? room.players.length}
        />
      </>
    );
  }

  return (
    <>
      <QuestionProgress current={currentIndex} total={questions.length} />

      <div className="card card-highlight">
        <p className="phase-label">
          Question {currentIndex + 1}/{questions.length}
        </p>
        <span className="theme-badge theme-badge-lg">{currentQuestion.theme}</span>
        <p className="question-hero">{currentQuestion.question}</p>
      </div>

      <div className="card">
        <h2>Qui a été le plus voté ?</h2>
        <p className="hint">
          Devine selon toi le joueur le plus voté — +1 pt par bonne réponse.
        </p>

        <div className="ranking-pick stagger-in">
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
  const winners = room.round?.winners ?? {};
  const myGuesses = room.round?.guesses[playerId] ?? {};

  return (
    <>
      <div className="card">
        <h2>Bilan de la manche</h2>
        {questions.map((q, i) => {
          const topId = winners[String(i)];
          const topName = room.players.find((p) => p.id === topId)?.name ?? "—";
          const myGuess = myGuesses[String(i)];
          const myGuessName =
            room.players.find((p) => p.id === myGuess)?.name ?? "—";
          const correct = myGuess === topId;

          return (
            <div key={q.id} className="reveal-question-block">
              <span className="theme-badge">{q.theme}</span>
              <p className="question-big-text">{q.question}</p>
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
        <ul className="player-list stagger-in">
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
}: {
  players: Player[];
  isHost: boolean;
  onRestart: () => Promise<void>;
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
        <ul className="result-list stagger-in">
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
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Connexion à la partie...</p>
      </div>
    );
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
      {error && <p className="error shake">{error}</p>}

      {room.phase !== "lobby" && room.phase !== "game-end" && (
        <div className="round-info fade-in">
          <span>
            Manche <span className="highlight">{room.currentRound}</span> /{" "}
            {room.totalRounds}
          </span>
        </div>
      )}

      <div key={room.phase} className="screen-enter">
      {room.phase === "lobby" && (
        <LobbyScreen
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          onStart={async (totalRounds, questionsPerRound) => {
            await dispatch({
              action: "start",
              playerId: session.playerId,
              totalRounds,
              questionsPerRound,
            });
          }}
          onSetThemes={async (themes) => {
            await dispatch({
              action: "set-themes",
              playerId: session.playerId,
              themes,
            });
          }}
          onKick={async (targetId) => {
            await dispatch({
              action: "kick",
              playerId: session.playerId,
              targetId,
            });
          }}
        />
      )}

      {room.phase === "round-intro" && (
        <RoundIntroScreen
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          onBeginVotes={async () => {
            await dispatch({
              action: "begin-votes",
              playerId: session.playerId,
            });
          }}
        />
      )}

      {room.phase === "ranking" && (
        <RankingScreen
          room={room}
          playerId={session.playerId}
          onVote={async (questionIndex, votedPlayerId) => {
            await dispatch({
              action: "rank",
              playerId: session.playerId,
              questionIndex,
              votedPlayerId,
            });
          }}
        />
      )}

      {room.phase === "guess-intro" && (
        <GuessIntroScreen
          room={room}
          isHost={isHost}
          onBeginGuess={async () => {
            await dispatch({
              action: "begin-guess",
              playerId: session.playerId,
            });
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
        />
      )}
      </div>
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

  const handleGameLeave = async () => {
    if (session) {
      try {
        await sendAction(session.roomCode, {
          action: "leave",
          playerId: session.playerId,
        });
      } catch {
        /* salon déjà fermé ou réseau coupé */
      }
    }
    handleLeave();
  };

  const handleSession = (s: Session, room?: RoomState) => {
    setSession(s);
    setInitialRoom(room ?? null);
    setRoomUrl(s.roomCode);
  };

  return (
    <div className="app-shell">
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-noise" aria-hidden="true" />

      {session && (
        <GameTopBar code={session.roomCode} onLeave={handleGameLeave} />
      )}

      <div className="app">
        <header className="app-header fade-in">
          <div className="logo-mark">🎲</div>
          <div>
            <h1>Tri-Pote</h1>
            <p className="subtitle">Salons privés entre potes — multijoueur</p>
          </div>
        </header>

        <main className="app-main">
          {session ? (
            <GameScreen
              session={session}
              initialRoom={initialRoom}
              onLeave={handleLeave}
            />
          ) : (
            <div className="screen-enter">
              <HomeScreen onSession={handleSession} initialCode={joinCode} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
