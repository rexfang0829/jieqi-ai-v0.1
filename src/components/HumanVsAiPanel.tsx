import { useEffect, useRef, useState } from 'react';
import type { GameState, Position, Side } from '../types/chess';
import { Board } from './Board';
import { applyMove, newGame } from '../game/gameEngine';
import { getAllLegalMoves, isInCheck } from '../game/checkRules';
import { filterThirdRepetitionMoves } from '../game/repetitionRules';
import { playBoardSoundFeedback } from '../game/soundEffects';
import { playEndgameSound } from '../game/endgameSound';
import { getEndgameFeedback, statusLabel } from '../game/endgameFeedback';
import { recommendMoveFair } from '../ai/simpleAi';
import { moveText } from '../game/moveNotation';
import { createGameRecord, saveGameRecord } from '../game/gameRecord';
import type { RecordStorage } from '../game/gameRecord';

type AiAnnotation = { score: number; reason: string; moveIndex: number };

type Props = {
  onHome: () => void;
  storage: RecordStorage | undefined;
};

export function HumanVsAiPanel({ onHome, storage }: Props) {
  const [humanSide, setHumanSide] = useState<Side | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => newGame());
  const [initialState, setInitialState] = useState<GameState | null>(null);
  const [past, setPast] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [lastAiInfo, setLastAiInfo] = useState<{ text: string; score: number; reason: string } | null>(null);
  const [aiAnnotations, setAiAnnotations] = useState<(AiAnnotation | null)[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const gameStateRef = useRef(gameState);
  const pastRef = useRef(past);
  const aiAnnotationsRef = useRef(aiAnnotations);
  const prevStatusRef = useRef<GameState['status']>('playing');

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { pastRef.current = past; }, [past]);
  useEffect(() => { aiAnnotationsRef.current = aiAnnotations; }, [aiAnnotations]);

  const aiSide: Side | null = humanSide === 'red' ? 'black' : humanSide === 'black' ? 'red' : null;
  const endgame = getEndgameFeedback(gameState.status);
  const isPlaying = gameState.status === 'playing';
  const isHumanTurn = isPlaying && humanSide !== null && gameState.turn === humanSide;
  const moveCount = gameState.history.length;

  const legalMoves = (isHumanTurn && selected)
    ? getAllLegalMoves(gameState.board, gameState.turn)
        .filter(m => m.from.row === selected.row && m.from.col === selected.col)
        .map(m => m.to)
    : [];

  function startGame(side: Side) {
    const initial = newGame();
    setHumanSide(side);
    setGameState(initial);
    setInitialState(initial);
    setPast([]);
    setSelected(null);
    setLastAiInfo(null);
    setAiAnnotations([]);
    setAiThinking(false);
    setSavedMsg('');
    prevStatusRef.current = 'playing';
    gameStateRef.current = initial;
    pastRef.current = [];
    aiAnnotationsRef.current = [];
  }

  function restart() {
    if (humanSide) startGame(humanSide);
  }

  /* AI turn trigger */
  useEffect(() => {
    if (!humanSide || !aiSide) return;
    if (gameState.status !== 'playing') return;
    if (gameState.turn !== aiSide) return;
    if (aiThinking) return;

    setAiThinking(true);
    const id = setTimeout(() => {
      const current = gameStateRef.current;
      if (current.status !== 'playing') { setAiThinking(false); return; }
      const legal = getAllLegalMoves(current.board, current.turn);
      const allowed = filterThirdRepetitionMoves(current, pastRef.current, legal);
      const candidates = allowed.length ? allowed : legal;
      const r = recommendMoveFair(current);
      if (!r.move) { setAiThinking(false); return; }
      const next = applyMove(current, r.move.from, r.move.to);
      const ann: AiAnnotation = { score: r.score, reason: r.reason, moveIndex: current.history.length };
      const nextAnns = [...aiAnnotationsRef.current, ann];
      aiAnnotationsRef.current = nextAnns;
      pastRef.current = [...pastRef.current, current];
      setPast(p => [...p, current]);
      setGameState(next);
      setAiAnnotations(nextAnns);
      setLastAiInfo({ text: moveText(r.move), score: r.score, reason: r.reason });
      playBoardSoundFeedback({ captured: !!r.move.captured, check: isInCheck(next.board, next.turn) });
      setAiThinking(false);
    }, 400);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turn, gameState.status, humanSide]);

  /* Endgame sound */
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = gameState.status;
    if (prev === 'playing' && (gameState.status === 'red_win' || gameState.status === 'black_win')) {
      playEndgameSound();
    }
  }, [gameState.status]);

  function click(pos: Position) {
    if (!isHumanTurn) return;
    const piece = gameState.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      const next = applyMove(gameState, selected, pos);
      if (next !== gameState) {
        aiAnnotationsRef.current = [...aiAnnotationsRef.current, null];
        setAiAnnotations(a => [...a, null]);
        setPast(h => [...h, gameState]);
        setGameState(next);
        playBoardSoundFeedback({
          captured: !!next.history[next.history.length - 1]?.captured,
          check: isInCheck(next.board, next.turn),
        });
      }
      setSelected(null);
      return;
    }
    if (piece && piece.side === humanSide) setSelected(pos);
    else setSelected(null);
  }

  function saveRecord() {
    if (!initialState) { setSavedMsg('請先開始一局'); return; }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    const title = '人 vs AI 測試 ' + dateStr;
    const perMove: ({ score: number; reason: string } | null)[] =
      gameState.history.map((_, i) => {
        const ann = aiAnnotations.find(a => a !== null && a.moveIndex === i);
        return ann ? { score: ann.score, reason: ann.reason } : null;
      });
    const record = {
      ...createGameRecord({
        title,
        moves: gameState.history,
        finalStatus: gameState.status,
        redPlayer: humanSide === 'red' ? '玩家（紅）' : 'AI（紅）',
        blackPlayer: humanSide === 'black' ? '玩家（黑）' : 'AI（黑）',
      }),
      initialState,
      moveAnnotations: perMove,
    };
    const ok = saveGameRecord(storage, record);
    setSavedMsg(ok ? '棋譜已儲存至打譜模式' : '儲存失敗');
  }

  /* Setup screen */
  if (!humanSide) {
    return (
      <main>
        <header>
          <button className="homeButton" onClick={onHome}>回首頁</button>
          <h1>人 vs AI 測試</h1>
          <span className="statusText" />
        </header>
        <div className="panel" style={{ maxWidth: 340, margin: '32px auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: 16 }}>選擇您執的顏色</h3>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button
              style={{ fontSize: 18, padding: '12px 28px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              onClick={() => startGame('red')}
            >執紅先手</button>
            <button
              style={{ fontSize: 18, padding: '12px 28px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              onClick={() => startGame('black')}
            >執黑後手</button>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 16 }}>
            AI 使用公平資訊 recommendMoveFair()，無需後端。
          </p>
        </div>
      </main>
    );
  }

  const humanLabel = humanSide === 'red' ? '紅方（玩家）' : '黑方（玩家）';
  const aiLabel = aiSide === 'red' ? '紅方（AI）' : '黑方（AI）';
  const turnText = !isPlaying
    ? statusLabel(gameState.status, gameState.turn)
    : gameState.turn === humanSide
      ? '輪到' + humanLabel
      : aiThinking ? aiLabel + '思考中…' : '輪到' + aiLabel;

  return (
    <main>
      <header>
        <button className="homeButton" onClick={onHome}>回首頁</button>
        <h1>人 vs AI 測試</h1>
        <span className="statusText">{turnText}</span>
      </header>

      {endgame && (
        <div className={'endgameBanner ' + endgame.winner}>
          <strong>{endgame.title}</strong>
          <span>{endgame.winnerText}</span>
          <small>本局結束</small>
        </div>
      )}

      <Board
        board={gameState.board}
        selected={selected}
        legalMoves={legalMoves}
        moves={gameState.history}
        lastMove={gameState.history[gameState.history.length - 1] ?? null}
        onSquareClick={click}
      />

      {lastAiInfo && (
        <div className="panel" style={{ marginTop: 8, fontSize: 13 }}>
          <strong style={{ color: '#94a3b8' }}>AI 上一步</strong>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: '#e2e8f0' }}>{lastAiInfo.text}</span>
            {'　'}
            <span style={{ color: '#64748b' }}>分數 {lastAiInfo.score}</span>
          </div>
          <div style={{ color: '#86efac', marginTop: 2 }}>{lastAiInfo.reason}</div>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
        <button onClick={restart}>重新開始</button>
        {initialState && moveCount > 0 && (
          <button onClick={saveRecord}>儲存棋譜</button>
        )}
      </div>

      {savedMsg && (
        <p style={{ textAlign: 'center', color: '#86efac', fontSize: 13, margin: '6px 0' }}>{savedMsg}</p>
      )}

      <p style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: '6px 0' }}>
        {humanLabel} vs {aiLabel} &nbsp;共 {moveCount} 手
      </p>
    </main>
  );
}
