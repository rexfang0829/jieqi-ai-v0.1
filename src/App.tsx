import { useEffect, useMemo, useState } from 'react';
import type { GameState, PieceType, Position } from './types/chess';
import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { GameRecordPanel } from './components/GameRecordPanel';
import { AiPanel } from './components/AiPanel';
import { WisdomPanel } from './components/WisdomPanel';
import { PositionEditor } from './components/PositionEditor';
import {
  clearBoard, clearSquare, correctSelectedRealType, editSquare, editSquareError,
  revealHotkeyType, revealSelectedByHotkey, setTurn, type PieceDraft,
} from './game/boardEditing';
import { applyMove, newGame } from './game/gameEngine';
import { cancelLastMoveSync, syncLastMove } from './game/lastMoveSync';
import { loadPosition, savePosition } from './game/positionStorage';
import { getAllLegalMoves, isInCheck } from './game/checkRules';
import { getEndgameFeedback, shouldPlayEndgameSound, statusLabel } from './game/endgameFeedback';
import { playEndgameSound } from './game/endgameSound';
import { editorPieceTypeNames } from './game/pieceText';
import { playCaptureSound, playCheckSound, playMoveSound, shouldPlayMoveSound } from './game/soundEffects';
import {
  createGameRecord, deleteGameRecord, loadGameRecords, resultText,
  saveGameRecord, type GameRecord,
} from './game/gameRecord';

type CorrectionAnchor = { x: number; y: number };
type AppMode = 'home' | 'play' | 'records' | 'ai-master' | 'editor';
type RecordsPage = 'library' | 'recent' | 'favorites' | 'masters' | 'playback';

const modeCards: { mode: Exclude<AppMode, 'home'>; title: string; body: string }[] = [
  { mode: 'play',      title: '一般揭棋模式',      body: '棋盤對弈主介面：翻子、落子、吃子、將軍、絕殺一氣呵成，支援長按修正暗子。' },
  { mode: 'records',   title: '打譜模式',           body: '棋譜庫管理與回放：儲存對局、逐步回放、檢視棋譜。' },
  { mode: 'ai-master', title: '輔助盤面模式',       body: '輸入盤面讓 AI 找出最佳解，分析最強後續着法。' },
  { mode: 'editor',    title: '局面編輯 / 測試模式', body: '清空棋盤、手動擺子、換手方、儲存與載入局面。' },
];

function storage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10) + ' ' + iso.slice(11, 16);
}

function resultClass(status: GameRecord['finalStatus']): string {
  if (status === 'red_win') return 'red';
  if (status === 'black_win') return 'black';
  return 'playing';
}

export default function App() {
  /* ── 共用遊戲狀態 ── */
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

  /* ── 棋譜模式子頁狀態 ── */
  const [recordsPage, setRecordsPage] = useState<RecordsPage>('library');
  const [recordsList, setRecordsList] = useState<GameRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [saveTitle, setSaveTitle] = useState('未命名棋譜');
  const [saveMsg, setSaveMsg] = useState('');
  const [playbackRecord, setPlaybackRecord] = useState<GameRecord | null>(null);
  const [playbackStep, setPlaybackStep] = useState(0);

  /* ── 衍生值 ── */
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

  /* 回放盤面：優先用快照，沒有快照才用 newGame() + applyMove fallback */
  const playbackState = useMemo(() => {
    if (!playbackRecord) return newGame();
    /* 快照優先：直接回傳對應步驟的完整局面 */
    const snap = playbackRecord.snapshots?.[playbackStep];
    if (snap) return snap;
    /* Fallback：逐步重播（舊棋譜或暗子可能不一致） */
    let s = newGame();
    for (let i = 0; i < playbackStep && i < playbackRecord.moves.length; i++) {
      const m = playbackRecord.moves[i];
      const next = applyMove(s, m.from, m.to);
      if (next !== s) s = next;
    }
    return s;
  }, [playbackRecord, playbackStep]);

  const playbackHasSnapshot = !!(playbackRecord?.snapshots?.length);

  /* 搜尋過濾 */
  const filteredRecords = useMemo(() => {
    const q = recordSearch.trim().toLowerCase();
    if (!q) return recordsList;
    return recordsList.filter(r => r.title.toLowerCase().includes(q));
  }, [recordsList, recordSearch]);

  /* ── 共用操作 ── */
  function closeCorrection() {
    setCorrectionPos(null);
    setCorrectionAnchor(null);
  }

  function cancelSync() {
    setSyncMode(false);
    setSyncFrom(null);
    setSyncError('');
  }

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
    if (nextMode === 'records') {
      setRecordsPage('library');
      setPlaybackRecord(null);
      setPlaybackStep(0);
      setRecordSearch('');
      setSaveMsg('');
      setRecordsList(loadGameRecords(storage()));
    }
  }

  function clampCorrectionAnchor(anchor: CorrectionAnchor): CorrectionAnchor {
    if (typeof window === 'undefined') return anchor;
    const margin = 12, panelWidth = 280, panelHeight = 230;
    const preferredX = anchor.x + 16, preferredY = anchor.y + 16;
    const x = Math.min(Math.max(preferredX, margin), Math.max(margin, window.innerWidth - panelWidth - margin));
    const yBelow = preferredY + panelHeight <= window.innerHeight - margin;
    const rawY = yBelow ? preferredY : anchor.y - panelHeight - 16;
    const y = Math.min(Math.max(rawY, margin), Math.max(margin, window.innerHeight - panelHeight - margin));
    return { x, y };
  }

  function pickMoveSound(next: GameState, hasCaptured: boolean) {
    if (isInCheck(next.board, next.turn)) playCheckSound();
    else if (hasCaptured) playCaptureSound();
    else playMoveSound();
  }

  function click(pos: Position) {
    if (syncMode) { syncClick(pos); return; }
    closeCorrection();
    if (state.status !== 'playing') { setSelected(pos); return; }

    const piece = state.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      const next = applyMove(state, selected, pos);
      if (next !== state) {
        setPast(h => [...h, state]);
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
    setState(newGame()); setPast([]); setSelected(null);
    closeCorrection(); setEditorError(''); cancelSync();
  }

  function clearCurrentBoard() {
    setPast(h => [...h, state]); setState(clearBoard(state));
    setSelected(null); closeCorrection(); setEditorError(''); cancelSync();
  }

  function saveCurrentPosition() { savePosition(storage(), state); }

  function loadSavedPosition() {
    const saved = loadPosition(storage());
    if (!saved) return;
    setState(saved); setPast([]); setSelected(null);
    closeCorrection(); setEditorError(''); cancelSync();
  }

  function changeTurn(turn: GameState['turn']) {
    setState(s => setTurn(s, turn)); setPast([]); setSelected(null);
    closeCorrection(); setEditorError(''); cancelSync();
  }

  function undo() {
    setPast(h => {
      if (!h.length) return h;
      const previous = h[h.length - 1];
      setState(previous); setSelected(null); closeCorrection(); setEditorError('');
      return h.slice(0, -1);
    });
  }

  function editSelectedPiece(patch: Partial<NonNullable<GameState['board'][number][number]>>) {
    if (!selected) return;
    const error = editSquareError(state, selected, patch);
    if (error) { setEditorError(error); return; }
    const next = editSquare(state, selected, patch);
    if (next === state) return;
    setPast(h => [...h, state]); setState(next); setEditorError('');
  }

  function createSelectedPiece(draft: PieceDraft) {
    if (!selected) return;
    const error = editSquareError(state, selected, {}, draft);
    if (error) { setEditorError(error); return; }
    const next = editSquare(state, selected, {}, draft);
    if (next === state) return;
    setPast(h => [...h, state]); setState(next); setEditorError('');
  }

  function clearSelectedSquare() {
    if (!selected) return;
    const next = clearSquare(state, selected);
    if (next === state) return;
    setPast(h => [...h, state]); setState(next); setEditorError('');
  }

  function openCorrection(pos: Position, anchor: CorrectionAnchor) {
    if (syncMode) return;
    if (!state.board[pos.row][pos.col]) return;
    setSelected(null); setCorrectionPos(pos);
    setCorrectionAnchor(clampCorrectionAnchor(anchor)); setEditorError('');
  }

  function applyCorrection(realType: PieceType) {
    if (!correctionPos) return;
    const error = editSquareError(state, correctionPos, { realType, revealed: true });
    if (error) { setEditorError(error); return; }
    const next = correctSelectedRealType(state, correctionPos, realType);
    if (next === state) return;
    setPast(h => [...h, state]); setState(next); closeCorrection(); setEditorError('');
  }

  function toggleSyncMode() {
    setSyncMode(active => {
      if (active) { setSyncFrom(null); setSyncError(''); return false; }
      setSelected(null); setSyncFrom(null); setSyncError(''); return true;
    });
  }

  function syncClick(pos: Position) {
    setSelected(null); setSyncError('');
    if (!syncFrom) { setSyncFrom(pos); return; }
    const result = syncLastMove(state, syncFrom, pos);
    if (result.applied) {
      setPast(h => [...h, state]); setState(result.state);
      if (shouldPlayMoveSound(state, result.state) && result.state.status === 'playing') {
        const lastMove = result.state.history[result.state.history.length - 1];
        pickMoveSound(result.state, !!lastMove?.captured);
      }
      setSyncMode(false); setSyncFrom(null); setSyncError(''); return;
    }
    cancelLastMoveSync(state); setSyncFrom(null); setSyncError('這一步不合法，未套用');
  }

  /* ── 棋譜模式操作 ── */
  function openRecentList() {
    setRecordsList(loadGameRecords(storage()));
    setRecordSearch('');
    setSaveMsg('');
    setRecordsPage('recent');
  }

  function saveCurrentGame() {
    /* snapshots = 初始局面 + 每手後的完整 GameState，供回放精確還原暗子 */
    const snapshots = [...past, state];
    const record = {
      ...createGameRecord({ title: saveTitle, moves: state.history, finalStatus: state.status }),
      snapshots,
    };
    const ok = saveGameRecord(storage(), record);
    setSaveMsg(ok ? '已儲存（含快照）' : '儲存失敗');
    if (ok) setRecordsList(loadGameRecords(storage()));
  }

  function deleteRecord(id: string) {
    deleteGameRecord(storage(), id);
    setRecordsList(loadGameRecords(storage()));
  }

  function openPlayback(record: GameRecord) {
    setPlaybackRecord(record);
    setPlaybackStep(0);
    setRecordsPage('playback');
  }

  function playbackPrev() {
    setPlaybackStep(s => Math.max(0, s - 1));
  }

  function playbackNext() {
    if (!playbackRecord) return;
    setPlaybackStep(s => Math.min(playbackRecord.moves.length, s + 1));
  }

  function analyzePlayback() {
    /* 預留：將 playbackState 帶入輔助盤面模式 */
    enterMode('ai-master');
  }

  /* ── Effects ── */
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      /* 棋種修正快捷鍵只在 editor / ai-master 模式允許，避免污染正式對局棋譜 */
      if (mode !== 'editor' && mode !== 'ai-master') return;
      const hotkeyType = revealHotkeyType(event.key);
      if (selected && hotkeyType) {
        const error = editSquareError(state, selected, { realType: hotkeyType, revealed: true });
        if (error) { event.preventDefault(); setEditorError(error); return; }
      }
      const next = revealSelectedByHotkey(state, selected, event.key);
      if (next === state) return;
      event.preventDefault();
      setPast(h => [...h, state]); setState(next); setEditorError('');
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [state, selected, mode]);

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
    if (shouldPlayEndgameSound(lastSoundStatus, state.status)) playEndgameSound();
    if (lastSoundStatus !== state.status) setLastSoundStatus(state.status);
  }, [lastSoundStatus, state.status]);

  /* ── 共用 UI 片段 ── */
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

  /* ══════════════════════════════════════════
     首頁
  ══════════════════════════════════════════ */
  if (mode === 'home') {
    return (
      <main className="homeScreen">
        <section className="homeHero">
          <h1>大盤揭棋 AI v0.1</h1>
          <p>選擇模式開始。揭棋對弈、棋譜打譜、輔助盤面分析與局面測試分開顯示。</p>
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

  /* ══════════════════════════════════════════
     輔助盤面模式
  ══════════════════════════════════════════ */
  if (mode === 'ai-master') {
    return (
      <main>
        {renderHeader('輔助盤面模式')}
        <AiPanel state={state} />
        <WisdomPanel />
      </main>
    );
  }

  /* ══════════════════════════════════════════
     打譜模式 — 三層頁面
  ══════════════════════════════════════════ */
  if (mode === 'records') {

    /* ── 棋譜庫首頁 ── */
    if (recordsPage === 'library') {
      const totalRecords = recordsList.length;
      return (
        <main>
          <header>
            <button className="homeButton" onClick={goHome}>回首頁</button>
            <h1>打譜模式</h1>
          </header>
          <div className="recordLibrary">
            <button className="recordLibCard" onClick={openRecentList}>
              <div>
                <strong>最近對局</strong>
                <br /><em>已儲存的對局棋譜</em>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="recordLibBadge">{totalRecords}</span>
                <span className="recordLibArrow">›</span>
              </div>
            </button>
            <button className="recordLibCard" onClick={() => setRecordsPage('favorites')}>
              <div>
                <strong>我的收藏</strong>
                <br /><em>標記收藏的棋譜</em>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="recordLibBadge">0</span>
                <span className="recordLibArrow">›</span>
              </div>
            </button>
            <button className="recordLibCard" onClick={() => setRecordsPage('masters')}>
              <div>
                <strong>大師棋譜</strong>
                <br /><em>精選揭棋名局</em>
              </div>
              <span className="recordLibArrow">›</span>
            </button>
          </div>
        </main>
      );
    }

    /* ── 我的收藏 / 大師棋譜（空狀態） ── */
    if (recordsPage === 'favorites' || recordsPage === 'masters') {
      const title = recordsPage === 'favorites' ? '我的收藏' : '大師棋譜';
      const msg   = recordsPage === 'favorites' ? '尚無收藏棋譜。' : '大師棋譜即將上線，敬請期待。';
      return (
        <main>
          <header>
            <button className="homeButton" onClick={() => setRecordsPage('library')}>返回</button>
            <h1>{title}</h1>
          </header>
          <div className="panel emptyModePanel">
            <p>{msg}</p>
          </div>
        </main>
      );
    }

    /* ── 最近對局列表 ── */
    if (recordsPage === 'recent') {
      return (
        <main>
          <header>
            <button className="homeButton" onClick={() => setRecordsPage('library')}>返回</button>
            <h1>最近對局</h1>
          </header>
          <div className="recordsListPage">

            {/* 儲存目前對局 */}
            <div className="recordsSaveBox">
              <label>儲存目前對局為棋譜</label>
              <input
                value={saveTitle}
                onChange={(e: { target: { value: string } }) => setSaveTitle(e.target.value)}
                placeholder="棋譜名稱"
              />
              <button onClick={saveCurrentGame}>儲存</button>
              {saveMsg && <p className="recordsSaveMsg">{saveMsg}</p>}
            </div>

            {/* 搜尋 */}
            <div className="recordsSearchWrap">
              <span className="recordsSearchIcon">🔍</span>
              <input
                value={recordSearch}
                onChange={(e: { target: { value: string } }) => setRecordSearch(e.target.value)}
                placeholder="依棋譜名稱搜尋"
              />
            </div>

            {/* 列表 */}
            <div className="recordsItems">
              {filteredRecords.length === 0 && (
                <p className="recordsEmpty">
                  {recordSearch ? '找不到符合的棋譜。' : '尚無已儲存棋譜，請先在對弈模式完成一局後儲存。'}
                </p>
              )}
              {filteredRecords.map(record => (
                <div key={record.id} style={{position:'relative'}}>
                  <button className="recordsItem" onClick={() => openPlayback(record)}>
                    <span className="recordsItemTitle">{record.title}</span>
                    <span className="recordsItemDate">{fmtDate(record.createdAt)}</span>
                    <span className="recordsItemMeta">{record.moveCount} 手</span>
                    <span className={`recordsItemResult ${resultClass(record.finalStatus)}`}>
                      {resultText(record.finalStatus)}
                    </span>
                  </button>
                  <button
                    className="recordsDeleteBtn"
                    style={{position:'absolute',right:8,bottom:8}}
                    onClick={() => deleteRecord(record.id)}
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>

          </div>
        </main>
      );
    }

    /* ── 棋譜回放頁 ── */
    if (recordsPage === 'playback' && playbackRecord) {
      const totalSteps = playbackRecord.moves.length;
      return (
        <main>
          <header>
            <button className="homeButton" onClick={() => setRecordsPage('recent')}>返回</button>
            <h1 style={{fontSize:'18px'}}>{playbackRecord.title}</h1>
          </header>
          <div className="playbackPage">

            {/* 左欄：盤面 + 控制 */}
            <div className="playbackMain">
              {/* 對局資訊 + 步數 */}
              <div className="playbackMeta" style={{marginBottom:10}}>
                <div>
                  <strong>{playbackRecord.title}</strong>
                  <br />
                  <em>{resultText(playbackRecord.finalStatus)}</em>
                  <br />
                  <small style={{fontSize:'11px',color: playbackHasSnapshot ? '#86efac' : '#fcd34d'}}>
                    {playbackHasSnapshot ? '✓ 快照回放' : '⚠ 舊棋譜重播，暗子可能不一致'}
                  </small>
                </div>
                <span className="playbackStep">第 {playbackStep} / {totalSteps} 步</span>
              </div>

              {/* 棋盤（只顯示，不互動） */}
              <Board
                board={playbackState.board}
                selected={null}
                legalMoves={[]}
                moves={playbackState.history}
                onSquareClick={() => {}}
              />

              {/* 上一步 / 下一步 */}
              <div className="playbackControls" style={{marginTop:10}}>
                <button onClick={() => setPlaybackStep(0)} disabled={playbackStep === 0}>⏮</button>
                <button onClick={playbackPrev} disabled={playbackStep === 0}>◀ 上一步</button>
                <button onClick={playbackNext} disabled={playbackStep >= totalSteps}>下一步 ▶</button>
                <button onClick={() => setPlaybackStep(totalSteps)} disabled={playbackStep >= totalSteps}>⏭</button>
              </div>

              {/* 分析按鈕 */}
              <button className="playbackAnalyzeBtn" style={{marginTop:10,width:'100%'}} onClick={analyzePlayback}>
                分析目前局面 →
              </button>
            </div>

            {/* 右欄（桌機）/ 下方（手機）：步驟捲動列 */}
            <div className="playbackSide">
              <div className="panel" style={{maxHeight:'none',padding:'10px 12px'}}>
                <h3 style={{marginBottom:8}}>棋譜導航</h3>
                <MoveList
                  moves={playbackRecord.moves}
                  activeStep={playbackStep}
                  onStepClick={setPlaybackStep}
                />
              </div>
            </div>

          </div>
        </main>
      );
    }
  }

  /* ══════════════════════════════════════════
     局面編輯 / 測試模式
  ══════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════
     一般揭棋模式（預設）
  ══════════════════════════════════════════ */
  return (
    <main>
      {renderHeader('一般揭棋模式')}
      {renderEndgameBanner()}
      <div className="toolbar">
        <button onClick={toggleSyncMode}>{syncMode ? '取消同步' : '同步上一手'}</button>
        <button onClick={undo} disabled={!past.length}>回到上一步</button>
      </div>
      {syncMode && (
        <div className={`panel syncPanel ${syncError ? 'syncError' : ''}`} style={{marginBottom:'12px'}}>
          {syncError || (syncFrom ? '同步上一手：請點終點' : '同步上一手：請點起點')}
        </div>
      )}
      {/* 正式對局：不傳 onSquareLongPress，禁止長按修正棋種 */}
      <Board board={state.board} selected={selected} syncFrom={syncFrom} legalMoves={legalMoves} moves={state.history} onSquareClick={click} />

      {/* 儲存目前對局的快捷入口（對弈模式底部） */}
      <GameRecordPanel state={state} />
    </main>
  );
}
