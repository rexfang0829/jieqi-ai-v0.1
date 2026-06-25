import { useEffect, useMemo, useState } from 'react';
import type { GameState, PieceType, Position } from './types/chess';
import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { CapturedPanel } from './components/CapturedPanel';
import { GameRecordPanel } from './components/GameRecordPanel';
import { AiPanel } from './components/AiPanel';
import { WisdomPanel } from './components/WisdomPanel';
import { PositionEditor } from './components/PositionEditor';
import { clearBoard, clearSquare, correctSelectedRealType, editSquare, editSquareError, revealHotkeyType, revealSelectedByHotkey, setTurn, type PieceDraft } from './game/boardEditing';
import { applyMove, newGame } from './game/gameEngine';
import { cancelLastMoveSync, syncLastMove } from './game/lastMoveSync';
import { loadPosition, savePosition } from './game/positionStorage';
import { getAllLegalMoves, isInCheck } from './game/checkRules';
import { getEndgameFeedback, shouldPlayEndgameSound, statusLabel } from './game/endgameFeedback';
import { playEndgameSound } from './game/endgameSound';
import { editorPieceTypeNames } from './game/pieceText';
import { playCaptureSound, playCheckSound, playMoveSound, shouldPlayMoveSound } from './game/soundEffects';

type CorrectionAnchor = { x: number; y: number };
type AppMode = 'home' | 'play' | 'records' | 'ai-vs-ai' | 'editor';

const modeCards: { mode: Exclude<AppMode, 'home'>; title: string; body: string }[] = [
  { mode: 'play', title: '接棋對弈模式', body: '手機實戰同步天天象棋盤面，保留棋盤、AI 建議、同步上一手、長按修正與被吃子資訊。' },
  { mode: 'records', title: '打譜模式', body: '管理棋譜儲存、載入、複製文字與匯出 JSON。' },
  { mode: 'ai-vs-ai', title: 'AI VS AI 模式', body: '先保留入口，之後再做 AI 自戰。' },
  { mode: 'editor', title: '局面編輯 / 測試模式', body: '清空棋盤、手動擺子、換手方、儲存與載入局面。' },
];

export default function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [state, setState] = useState(() => newGame());
  const [past, setPast] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [syncMode, setSyncMode] = useState(false);
  const [syncFrom, setSyncFrom] = useState<Position | null>(null);
  const [syncError, setSyncError] = useState('');
  const [lastSoundStatus, setLastSoundStatus] = useState(state.status);
  const [editorError, setEditorError] = useState('');
  const [correctionPos, setCorrectionPos] = useState<Position | null>(null);
  const [correctionAnchor, setCorrectionAnchor] = useState<CorrectionAnchor | null>(null);

  const legalMoves = useMemo(
    () => state.status === 'playing' && selected
      ? getAllLegalMoves(state.board, state.turn)
        .filter(m => m.from.row === selected.row && m.from.col === selected.col)
        .map(m => m.to)
      : [],
    [state, selected],
  );
  const endgameFeedback = getEndgameFeedback(state.status);
  const statusText = statusLabel(state.status, state.turn);
  const correctionPanelStyle = correctionAnchor
    ? { left: `${correctionAnchor.x}px`, top: `${correctionAnchor.y}px` }
    : undefined;

  function goHome() {
    setMode('home');
    setSelected(null);
    closeCorrection();
    cancelSync();
  }

  function enterMode(nextMode: Exclude<AppMode, 'home'>) {
    setMode(nextMode);
    setSelected(null);
    closeCorrection();
    cancelSync();
  }

  function closeCorrection() {
    setCorrectionPos(null);
    setCorrectionAnchor(null);
  }

  function clampCorrectionAnchor(anchor: CorrectionAnchor): CorrectionAnchor {
    if (typeof window === 'undefined') return anchor;
    const margin = 12;
    const panelWidth = 280;
    const panelHeight = 230;
    const preferredX = anchor.x + 16;
    const preferredY = anchor.y + 16;
    const x = Math.min(Math.max(preferredX, margin), Math.max(margin, window.innerWidth - panelWidth - margin));
    const yBelow = preferredY + panelHeight <= window.innerHeight - margin;
    const rawY = yBelow ? preferredY : anchor.y - panelHeight - 16;
    const y = Math.min(Math.max(rawY, margin), Math.max(margin, window.innerHeight - panelHeight - margin));
    return { x, y };
  }

  function pickMoveSound(next: GameState, hasCaptured: boolean) {
    if (isInCheck(next.board, next.turn)) {
      playCheckSound();
    } else if (hasCaptured) {
      playCaptureSound();
    } else {
      playMoveSound();
    }
  }

  function click(pos: Position) {
    if (syncMode) {
      syncClick(pos);
      return;
    }
    closeCorrection();

    if (state.status !== 'playing') {
      setSelected(pos);
      return;
    }

    const piece = state.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      const next = applyMove(state, selected, pos);
      if (next !== state) {
        setPast(history => [...history, state]);
        setState(next);
        if (shouldPlayMoveSound(state, next) && next.status === 'playing') {
          const lastMove = next.history[next.history.length - 1];
          pickMoveSound(next, !!lastMove?.captured);
        }
      }
      setSelected(null);
      return;
    }

    if (piece?.side === state.turn || !piece) setSelected(pos);
    else setSelected(pos);
  }

  function resetToInitial() {
    setState(newGame());
    setPast([]);
    setSelected(null);
    closeCorrection();
    setEditorError('');
    cancelSync();
  }

  function clearCurrentBoard() {
    setPast(history => [...history, state]);
    setState(clearBoard(state));
    setSelected(null);
    closeCorrection();
    setEditorError('');
    cancelSync();
  }

  function storage() {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  }

  function saveCurrentPosition() {
    savePosition(storage(), state);
  }

  function loadSavedPosition() {
    const saved = loadPosition(storage());
    if (!saved) return;
    setState(saved);
    setPast([]);
    setSelected(null);
    closeCorrection();
    setEditorError('');
    cancelSync();
  }

  function changeTurn(turn: GameState['turn']) {
    setState(s => setTurn(s, turn));
    setPast([]);
    setSelected(null);
    closeCorrection();
    setEditorError('');
    cancelSync();
  }

  function undo() {
    setPast(history => {
      if (!history.length) return history;
      const previous = history[history.length - 1];
      setState(previous);
      setSelected(null);
      closeCorrection();
      setEditorError('');
      return history.slice(0, -1);
    });
  }

  function editSelectedPiece(patch: Partial<NonNullable<GameState['board'][number][number]>>) {
    if (!selected) return;
    const error = editSquareError(state, selected, patch);
    if (error) {
      setEditorError(error);
      return;
    }
    const next = editSquare(state, selected, patch);
    if (next === state) return;
    setPast(history => [...history, state]);
    setState(next);
    setEditorError('');
  }

  function createSelectedPiece(draft: PieceDraft) {
    if (!selected) return;
    const error = editSquareError(state, selected, {}, draft);
    if (error) {
      setEditorError(error);
      return;
    }
    const next = editSquare(state, selected, {}, draft);
    if (next === state) return;
    setPast(history => [...history, state]);
    setState(next);
    setEditorError('');
  }

  function clearSelectedSquare() {
    if (!selected) return;
    const next = clearSquare(state, selected);
    if (next === state) return;
    setPast(history => [...history, state]);
    setState(next);
    setEditorError('');
  }

  function openCorrection(pos: Position, anchor: CorrectionAnchor) {
    if (syncMode) return;
    if (!state.board[pos.row][pos.col]) return;
    setSelected(null);
    setCorrectionPos(pos);
    setCorrectionAnchor(clampCorrectionAnchor(anchor));
    setEditorError('');
  }

  function applyCorrection(realType: PieceType) {
    if (!correctionPos) return;
    const error = editSquareError(state, correctionPos, { realType, revealed: true });
    if (error) {
      setEditorError(error);
      return;
    }
    const next = correctSelectedRealType(state, correctionPos, realType);
    if (next === state) return;
    setPast(history => [...history, state]);
    setState(next);
    closeCorrection();
    setEditorError('');
  }

  function toggleSyncMode() {
    setSyncMode(active => {
      if (active) {
        setSyncFrom(null);
        setSyncError('');
        return false;
      }
      setSelected(null);
      setSyncFrom(null);
      setSyncError('');
      return true;
    });
  }

  function cancelSync() {
    setSyncMode(false);
    setSyncFrom(null);
    setSyncError('');
  }

  function syncClick(pos: Position) {
    setSelected(null);
    setSyncError('');

    if (!syncFrom) {
      setSyncFrom(pos);
      return;
    }

    const result = syncLastMove(state, syncFrom, pos);
    if (result.applied) {
      setPast(history => [...history, state]);
      setState(result.state);
      if (shouldPlayMoveSound(state, result.state) && result.state.status === 'playing') {
        const lastMove = result.state.history[result.state.history.length - 1];
        pickMoveSound(result.state, !!lastMove?.captured);
      }
      setSyncMode(false);
      setSyncFrom(null);
      setSyncError('');
      return;
    }

    cancelLastMoveSync(state);
    setSyncFrom(null);
    setSyncError('這一步不合法，未套用');
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;

      const hotkeyType = revealHotkeyType(event.key);
      if (selected && hotkeyType) {
        const error = editSquareError(state, selected, { realType: hotkeyType, revealed: true });
        if (error) {
          event.preventDefault();
          setEditorError(error);
          return;
        }
      }
      const next = revealSelectedByHotkey(state, selected, event.key);
      if (next === state) return;
      event.preventDefault();
      setPast(history => [...history, state]);
      setState(next);
      setEditorError('');
    }

    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [state, selected]);

  useEffect(() => {
    if (!correctionPos) return;

    function pointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.correctionPanel')) return;
      closeCorrection();
    }

    document.addEventListener('pointerdown', pointerDown);
    return () => document.removeEventListener('pointerdown', pointerDown);
  }, [correctionPos]);

  useEffect(() => {
    if (shouldPlayEndgameSound(lastSoundStatus, state.status)) {
      playEndgameSound();
    }
    if (lastSoundStatus !== state.status) {
      setLastSoundStatus(state.status);
    }
  }, [lastSoundStatus, state.status]);

  function renderHeader(title: string) {
    return (
      <header>
        <button className="homeButton" onClick={goHome}>回首頁</button>
        <h1>{title}</h1>
        <span className={endgameFeedback ? 'statusText endgameStatus' : 'statusText'}>{statusText}</span>
      </header>
    );
  }

  function renderCorrectionPanel() {
    if (!correctionPos) return null;
    return (
      <div className="panel correctionPanel" style={correctionPanelStyle}>
        <h3>修正棋種</h3>
        <p>長按棋子後，可手動修正翻開後的真實棋種。</p>
        <div className="correctionButtons">
          {(['rook', 'horse', 'elephant', 'advisor', 'cannon', 'pawn'] as PieceType[]).map(type => (
            <button key={type} onClick={() => applyCorrection(type)}>{editorPieceTypeNames[type]}</button>
          ))}
        </div>
        {editorError && <p className="editorError">{editorError}</p>}
        <button onClick={closeCorrection}>取消</button>
      </div>
    );
  }

  function renderEndgameBanner() {
    if (!endgameFeedback) return null;
    return (
      <div className={`endgameBanner ${endgameFeedback.winner}`}>
        <strong>{endgameFeedback.title}</strong>
        <span>{endgameFeedback.winnerText}</span>
        <small>本局結束</small>
      </div>
    );
  }

  if (mode === 'home') {
    return (
      <main className="homeScreen">
        <section className="homeHero">
          <h1>大盤揭棋 AI v0.1</h1>
          <p>選擇目前要使用的模式。實戰接棋、棋譜管理、AI 自戰入口與局面測試分開顯示。</p>
        </section>
        <section className="modeGrid">
          {modeCards.map(card => (
            <button className="modeCard" key={card.mode} onClick={() => enterMode(card.mode)}>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
            </button>
          ))}
        </section>
      </main>
    );
  }

  if (mode === 'ai-vs-ai') {
    return (
      <main>
        {renderHeader('AI VS AI 模式')}
        <section className="panel emptyModePanel">
          <h2>AI VS AI 尚未啟用</h2>
          <p>本階段只建立入口，暫時不做 AI 自戰。</p>
        </section>
      </main>
    );
  }

  if (mode === 'records') {
    return (
      <main>
        {renderHeader('打譜模式')}
        <div className="modeLayout recordsMode">
          <GameRecordPanel state={state} />
          <MoveList moves={state.history} />
        </div>
      </main>
    );
  }

  if (mode === 'editor') {
    return (
      <main>
        {renderHeader('局面編輯 / 測試模式')}
        {renderEndgameBanner()}
        <div className="toolbar">
          <button onClick={resetToInitial}>恢復初始局面</button>
          <button onClick={clearCurrentBoard}>清空棋盤</button>
          <button onClick={saveCurrentPosition}>儲存目前局面</button>
          <button onClick={loadSavedPosition}>載入已儲存局面</button>
          <button onClick={undo} disabled={!past.length}>回到上一步</button>
          <label className="turnSelector">
            輪到
            <select value={state.turn} onChange={(event: { target: { value: string } }) => changeTurn(event.target.value as GameState['turn'])}>
              <option value="red">紅方</option>
              <option value="black">黑方</option>
            </select>
          </label>
        </div>
        <div className="layout editorMode">
          <Board board={state.board} selected={selected} syncFrom={syncFrom} legalMoves={legalMoves} moves={state.history} onSquareClick={click} onSquareLongPress={openCorrection} />
          <aside>
            <div className="panel hotkeyHint">翻子快捷鍵：1車 2馬 3象 4士 5炮 6兵</div>
            {renderCorrectionPanel()}
            <PositionEditor
              selected={selected}
              piece={selected ? state.board[selected.row][selected.col] : null}
              onUpdatePiece={editSelectedPiece}
              onCreatePiece={createSelectedPiece}
              onClearSquare={clearSelectedSquare}
              error={!correctionPos ? editorError : ''}
            />
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main>
      {renderHeader('接棋對弈模式')}
      {renderEndgameBanner()}
      <div className="toolbar">
        <button onClick={toggleSyncMode}>{syncMode ? '取消同步' : '同步上一手'}</button>
        <button onClick={undo} disabled={!past.length}>回到上一步</button>
      </div>
      <div className="layout playMode">
        <Board board={state.board} selected={selected} syncFrom={syncFrom} legalMoves={legalMoves} moves={state.history} onSquareClick={click} onSquareLongPress={openCorrection} />
        <aside>
          <AiPanel state={state} />
          {syncMode && (
            <div className={`panel syncPanel ${syncError ? 'syncError' : ''}`}>
              {syncError || (syncFrom ? '同步上一手：請點終點' : '同步上一手：請點起點')}
            </div>
          )}
          <div className="panel hotkeyHint">翻子快捷鍵：1車 2馬 3象 4士 5炮 6兵</div>
          {renderCorrectionPanel()}
          <CapturedPanel moves={state.history} />
          <MoveList moves={state.history} />
          <WisdomPanel />
        </aside>
      </div>
    </main>
  );
}
