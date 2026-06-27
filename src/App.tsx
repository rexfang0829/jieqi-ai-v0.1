import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Move, PieceType, Position } from './types/chess';
import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { AiPanel } from './components/AiPanel';
import { WisdomPanel } from './components/WisdomPanel';
import { PositionEditor } from './components/PositionEditor';
import { HumanVsAiPanel } from './components/HumanVsAiPanel';
import {
  clearBoard, clearSquare, correctSelectedRealType, editSquare, editSquareError,
  revealHotkeyType, revealSelectedByHotkey, setTurn, type PieceDraft,
} from './game/boardEditing';
import { applyMove, newGame } from './game/gameEngine';
import { cancelLastMoveSync, syncLastMove } from './game/lastMoveSync';
import { loadPosition, savePosition } from './game/positionStorage';
import { getAllLegalMoves, isInCheck } from './game/checkRules';
import {
  AI_REPEAT_END_MESSAGE,
  REPETITION_DRAW_MESSAGE,
  THIRD_REPETITION_MESSAGE,
  countPositionKey,
  filterThirdRepetitionMoves,
  getPositionKey,
  isRepetitionDraw,
  wouldCauseThirdRepetition,
} from './game/repetitionRules';
import { getEndgameFeedback, shouldPlayEndgameSound, statusLabel } from './game/endgameFeedback';
import { playEndgameSound, playTimeoutSound } from './game/endgameSound';
import { editorPieceTypeNames } from './game/pieceText';
import { playBoardSoundFeedback } from './game/soundEffects';
import { recommendMoveFair } from './ai/simpleAi';
import {
  createGameRecord, deleteGameRecord, loadGameRecords, resultText,
  saveGameRecord, toggleFavoriteRecord, type GameRecord, type GameVariation,
} from './game/gameRecord';

type CorrectionAnchor = { x: number; y: number };
type AppMode = 'home' | 'play' | 'records' | 'ai-master' | 'ai-vs-ai' | 'editor' | 'human-vs-ai';
type RecordsPage = 'library' | 'recent' | 'favorites' | 'masters' | 'playback';
type AnalysisSource = { recordId: string; baseStep: number; baseState: GameState };

const modeCards: { mode: Exclude<AppMode, 'home'>; title: string; body: string }[] = [
  { mode: 'play',         title: '一般揭棋模式',      body: '棋盤對弈主介面：翻子、落子、吃子、將軍、絕殺一氣呵成；含 10 分鐘對弈鐘，自動儲存棋譜（不支援長按修正棋種）。' },
  { mode: 'records',      title: '打譜模式',           body: '棋譜庫管理與回放：儲存對局、逐步回放、檢視棋譜。' },
  { mode: 'human-vs-ai',  title: '人 vs AI 測試',      body: '選擇執紅或執黑，與 AI 對弈。AI 每步自動走棋並顯示思考理由，可儲存棋譜至打譜模式。' },
  { mode: 'ai-master',    title: '輔助盤面模式',       body: '輸入盤面讓 AI 找出最佳解，分析最強後續着法。' },
  { mode: 'ai-vs-ai',     title: 'AI VS AI 模式',      body: '讓紅黑雙方都由 AI 自動對弈，可單步 / 自動播放，並儲存棋譜。' },
  { mode: 'editor',       title: '局面編輯 / 測試模式', body: '清空棋盤、手動擺子、換手方、儲存與載入局面。' },
];

function storage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '時間未知';
    return d.toLocaleString();
  } catch {
    return '時間未知';
  }
}

function resultClass(status: GameRecord['finalStatus']): string {
  if (status === 'red_win') return 'red';
  if (status === 'black_win') return 'black';
  return 'playing';
}

function stateAtRecordStep(record: GameRecord, step: number): GameState {
  function applyUpTo(start: GameState, moves: GameRecord['moves'], upTo: number) {
    let s = start;
    for (let i = 0; i < upTo && i < moves.length; i++) {
      const m = moves[i];
      const next = applyMove(s, m.from, m.to);
      if (next !== s) s = next;
    }
    return s;
  }

  if (record.initialState) return applyUpTo(record.initialState, record.moves, step);
  const snap = record.snapshots?.[step];
  if (snap) return snap;
  return applyUpTo(newGame(), record.moves, step);
}

function fmtMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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
  const [repeatError, setRepeatError] = useState('');
  const [lastSoundStatus, setLastSoundStatus] = useState(state.status);
  const playbackSoundStepRef = useRef<number>(-1);  // 追蹤上一次播音的 step，避免 mount 時誤播
  const [editorError, setEditorError] = useState('');
  const [correctionPos, setCorrectionPos] = useState<Position | null>(null);
  const [correctionAnchor, setCorrectionAnchor] = useState<CorrectionAnchor | null>(null);

  /* ── 一般揭棋模式：快速儲存棋譜 ── */
  const [playQuickSave, setPlayQuickSave] = useState(false);
  const [playQuickTitle, setPlayQuickTitle] = useState('未命名棋譜');
  const [playQuickMsg, setPlayQuickMsg] = useState('');
  const [aiMasterNote, setAiMasterNote] = useState<string | null>(null);
  const [analyzeVersion, setAnalyzeVersion] = useState(0);

  /* ── 一般揭棋模式：自動存檔 + 計時 ── */
  const PLAY_INIT_MS = 10 * 60 * 1000;
  const [playAutoSaveInitial, setPlayAutoSaveInitial] = useState<GameState | null>(null);
  const playAutoSaveIdRef = useRef<string | null>(null);
  const [playTimeoutSide, setPlayTimeoutSide] = useState<'red' | 'black' | null>(null);
  const [playAutoSaveMsg, setPlayAutoSaveMsg] = useState('');
  const [redTimeMs, setRedTimeMs] = useState(PLAY_INIT_MS);
  const [blackTimeMs, setBlackTimeMs] = useState(PLAY_INIT_MS);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayTimeoutRef = useRef(false);  // 避免 timeout 後全域 endgame effect 再播「絕殺」

  /* ── AI VS AI 模式 ── */
  const [aiVsAiState, setAiVsAiState] = useState<GameState>(() => newGame());
  const [aiVsAiInitial, setAiVsAiInitial] = useState<GameState | null>(null);
  const [aiVsAiAutoPlay, setAiVsAiAutoPlay] = useState(false);
  const [aiVsAiMsg, setAiVsAiMsg] = useState('');
  const [aiVsAiPast, setAiVsAiPast] = useState<GameState[]>([]);
  const aiVsAiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiVsAiStateRef = useRef<GameState>(aiVsAiState);
  const aiVsAiPastRef = useRef<GameState[]>([]);
  const aiVsAiLastStatusRef = useRef<GameState['status']>('playing');

  /* ── 棋譜模式子頁狀態 ── */
  const [recordsPage, setRecordsPage] = useState<RecordsPage>('library');
  const [recordsList, setRecordsList] = useState<GameRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [saveTitle, setSaveTitle] = useState('未命名棋譜');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveRedPlayer, setSaveRedPlayer] = useState('紅方');
  const [saveBlackPlayer, setSaveBlackPlayer] = useState('黑方');
  const [playbackRecord, setPlaybackRecord] = useState<GameRecord | null>(null);
  const [playbackStep, setPlaybackStep] = useState(0);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(null);
  const [analysisMoves, setAnalysisMoves] = useState<Move[]>([]);
  const [analysisMsg, setAnalysisMsg] = useState('');

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

  /* 回放盤面：優先 initialState + moves 推演；次選 snapshots（舊棋譜相容）；最後 fallback newGame */
  const playbackState = useMemo(() => {
    if (!playbackRecord) return newGame();

    function applyUpTo(start: ReturnType<typeof newGame>, upTo: number) {
      let s = start;
      for (let i = 0; i < upTo && i < playbackRecord!.moves.length; i++) {
        const m = playbackRecord!.moves[i];
        const next = applyMove(s, m.from, m.to);
        if (next !== s) s = next;
      }
      return s;
    }

    /* 優先：initialState + moves 推演（精確，不隨機） */
    if (playbackRecord.initialState) {
      return applyUpTo(playbackRecord.initialState, playbackStep);
    }
    /* 次選：snapshots 直接取步驟（舊棋譜，每步全量存法） */
    const snap = playbackRecord.snapshots?.[playbackStep];
    if (snap) return snap;
    /* 最後 fallback：newGame() + moves 推演（暗子可能不一致） */
    return applyUpTo(newGame(), playbackStep);
  }, [playbackRecord, playbackStep]);

  const playbackHasSnapshot = !!(playbackRecord?.initialState || playbackRecord?.snapshots?.length);

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

  function moveFor(from: Position, to: Position): Move | undefined {
    return getAllLegalMoves(state.board, state.turn).find(move =>
      move.from.row === from.row &&
      move.from.col === from.col &&
      move.to.row === to.row &&
      move.to.col === to.col
    );
  }

  function blocksThirdRepetition(from: Position, to: Position): boolean {
    const move = moveFor(from, to);
    return !!move && mode === 'play' && wouldCauseThirdRepetition(state, past, move);
  }

  function goHome() {
    setMode('home');
    setSelected(null);
    setRepeatError('');
    closeCorrection();
    cancelSync();
    setAnalysisSource(null);
    setAnalysisMoves([]);
    setAnalysisMsg('');
  }

  function enterMode(nextMode: Exclude<AppMode, 'home'>) {
    setMode(nextMode);
    setSelected(null);
    setRepeatError('');
    if (nextMode === 'ai-master') setAiMasterNote(null);
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
    if (nextMode === 'play') {
      const initial = newGame();
      setState(initial); setPast([]); setSelected(null);
      setRepeatError('');
      setPlayAutoSaveInitial(initial);
      playAutoSaveIdRef.current = null;
      isPlayTimeoutRef.current = false;
      setPlayTimeoutSide(null);
      setPlayAutoSaveMsg('');
      setRedTimeMs(PLAY_INIT_MS);
      setBlackTimeMs(PLAY_INIT_MS);
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

  function click(pos: Position) {
    if (syncMode) { syncClick(pos); return; }
    closeCorrection();
    if (state.status !== 'playing') { setSelected(pos); return; }

    const piece = state.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      if (blocksThirdRepetition(selected, pos)) {
        setRepeatError(THIRD_REPETITION_MESSAGE);
        setSelected(null);
        return;
      }
      const next = applyMove(state, selected, pos);
      if (next !== state) {
        setPast(h => [...h, state]);
        setState(next);
        setRepeatError('');
        const lastMove = next.history[next.history.length - 1];
        if (analysisSource && lastMove) {
          setAnalysisMoves(moves => [...moves, lastMove]);
          setAnalysisMsg('');
        }
        playBoardSoundFeedback({
          captured: !!lastMove?.captured,
          check: isInCheck(next.board, next.turn),
        });
      }
      setSelected(null);
      return;
    }
    if (piece?.side === state.turn || !piece) setSelected(pos);
    else setSelected(pos);
  }

  function resetToInitial() {
    setState(newGame()); setPast([]); setSelected(null);
    setRepeatError(''); closeCorrection(); setEditorError(''); cancelSync();
  }

  function clearCurrentBoard() {
    setPast(h => [...h, state]); setState(clearBoard(state));
    setSelected(null); setRepeatError(''); closeCorrection(); setEditorError(''); cancelSync();
  }

  function saveCurrentPosition() { savePosition(storage(), state); }

  function loadSavedPosition() {
    const saved = loadPosition(storage());
    if (!saved) return;
    setState(saved); setPast([]); setSelected(null);
    setRepeatError(''); closeCorrection(); setEditorError(''); cancelSync();
  }

  function changeTurn(turn: GameState['turn']) {
    setState(s => setTurn(s, turn)); setPast([]); setSelected(null);
    setRepeatError(''); closeCorrection(); setEditorError(''); cancelSync();
  }

  function undo() {
    setPast(h => {
      if (!h.length) return h;
      const previous = h[h.length - 1];
      setState(previous); setSelected(null); setRepeatError(''); closeCorrection(); setEditorError('');
      if (analysisSource) setAnalysisMoves(moves => moves.slice(0, -1));
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
    if (blocksThirdRepetition(syncFrom, pos)) {
      setSyncFrom(null);
      setSyncError(THIRD_REPETITION_MESSAGE);
      setRepeatError(THIRD_REPETITION_MESSAGE);
      return;
    }
    const result = syncLastMove(state, syncFrom, pos);
    if (result.applied) {
      setPast(h => [...h, state]); setState(result.state);
      setRepeatError('');
      const lastMove = result.state.history[result.state.history.length - 1];
      playBoardSoundFeedback({
        captured: !!lastMove?.captured,
        check: isInCheck(result.state.board, result.state.turn),
      });
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
    /* 只存 initialState（開局完整暗子配置），不存每步 snapshots，節省 localStorage */
    const initialState = past.length > 0 ? past[0] : state;
    const record = {
      ...createGameRecord({ title: saveTitle, moves: state.history, finalStatus: state.status, redPlayer: saveRedPlayer, blackPlayer: saveBlackPlayer }),
      initialState,
    };
    const ok = saveGameRecord(storage(), record);
    setSaveMsg(ok ? '已儲存（含初始快照）' : '儲存失敗');
    if (ok) setRecordsList(loadGameRecords(storage()));
  }

  /* 一般揭棋模式：快速儲存棋譜 */
  function savePlayQuick() {
    const initialState = past.length > 0 ? past[0] : state;
    const record = {
      ...createGameRecord({ title: playQuickTitle.trim() || '未命名棋譜', moves: state.history, finalStatus: state.status, redPlayer: '紅方', blackPlayer: '黑方' }),
      initialState,
    };
    const ok = saveGameRecord(storage(), record);
    setPlayQuickMsg(ok ? '棋譜已儲存' : '儲存失敗');
    setPlayQuickSave(false);
  }

  function deleteRecord(id: string) {
    deleteGameRecord(storage(), id);
    setRecordsList(loadGameRecords(storage()));
  }

  function openPlayback(record: GameRecord) {
    setPlaybackRecord(record);
    setPlaybackStep(0);
    setAnalysisSource(null);
    setAnalysisMoves([]);
    setAnalysisMsg('');
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
    /* 深複製 playbackState，避免共用 reference 污染 */
    const snapshot: GameState = (typeof structuredClone === 'function')
      ? structuredClone(playbackState)
      : JSON.parse(JSON.stringify(playbackState));
    setState(snapshot);
    setPast([]);
    setSelected(null);
    closeCorrection();
    cancelSync();
    if (playbackRecord) {
      setAnalysisSource({ recordId: playbackRecord.id, baseStep: playbackStep, baseState: snapshot });
      setAnalysisMoves([]);
      setAnalysisMsg('');
    }
    const title = playbackRecord?.title ?? '棋譜';
    setAiMasterNote(`已載入「${title}」第 ${playbackStep} 手局面`);
    setMode('ai-master');  // 直接切換，不走 enterMode（避免清掉 aiMasterNote）
  }

  /* ── 一般揭棋模式：新局 + 收藏 ── */
  function saveAnalysisVariation() {
    if (!analysisSource || analysisMoves.length === 0) return;
    const records = loadGameRecords(storage());
    const sourceRecord = records.find(record => record.id === analysisSource.recordId);
    if (!sourceRecord) { setAnalysisMsg('找不到原棋譜，無法儲存變化'); return; }
    const existing = sourceRecord.variations ?? [];
    const sameStepCount = existing.filter(variation => variation.baseStep === analysisSource.baseStep).length;
    const now = new Date().toISOString();
    const variation: GameVariation = {
      id: `variation-${Date.now()}`,
      baseStep: analysisSource.baseStep,
      title: `第 ${analysisSource.baseStep} 手變化 ${sameStepCount + 1}`,
      moves: analysisMoves,
      createdAt: now,
      updatedAt: now,
      source: 'manual-analysis',
    };
    const nextRecord = { ...sourceRecord, variations: [...existing, variation] };
    const ok = saveGameRecord(storage(), nextRecord);
    if (!ok) { setAnalysisMsg('變化儲存失敗'); return; }
    setAnalysisMoves([]);
    setAnalysisMsg('變化已儲存');
    setRecordsList(loadGameRecords(storage()));
    if (playbackRecord?.id === sourceRecord.id) setPlaybackRecord(nextRecord);
  }

  function openVariationPlayback(variation: GameVariation) {
    if (!playbackRecord) return;
    const baseState = stateAtRecordStep(playbackRecord, variation.baseStep);
    setPlaybackRecord({
      ...playbackRecord,
      id: `${playbackRecord.id}:${variation.id}`,
      title: variation.title,
      moves: variation.moves,
      initialState: baseState,
      snapshots: undefined,
      variations: [],
      finalStatus: 'playing',
      moveCount: variation.moves.length,
    });
    setPlaybackStep(0);
  }

  function startNewPlayGame() {
    const initial = newGame();
    setState(initial); setPast([]); setSelected(null);
    setRepeatError('');
    closeCorrection(); cancelSync();
    setPlayAutoSaveInitial(initial);
    playAutoSaveIdRef.current = null;
    isPlayTimeoutRef.current = false;
    setPlayTimeoutSide(null);
    setPlayAutoSaveMsg('');
    setRedTimeMs(PLAY_INIT_MS);
    setBlackTimeMs(PLAY_INIT_MS);
  }

  function toggleFavorite(id: string) {
    toggleFavoriteRecord(storage(), id);
    setRecordsList(loadGameRecords(storage()));
  }

  /* ── AI VS AI 模式 函式 ── */
  function startAiVsAiGame() {
    const initial = newGame();
    setAiVsAiState(initial);
    setAiVsAiInitial(initial);
    setAiVsAiPast([]);
    aiVsAiPastRef.current = [];
    setAiVsAiAutoPlay(false);
    setAiVsAiMsg('');
  }

  function aiVsAiStep() {
    const current = aiVsAiStateRef.current;
    if (current.status !== 'playing') return;
    // 4次重複同一局面则判定和棋
    if (isRepetitionDraw(current, aiVsAiPastRef.current)) {
      setAiVsAiAutoPlay(false);
      setAiVsAiMsg(REPETITION_DRAW_MESSAGE);
      return;
    }
    if (current.history.length >= 300) { setAiVsAiMsg('已達手數上限（300 手）'); return; }
    const legalMoves = getAllLegalMoves(current.board, current.turn);
    const allowedMoves = filterThirdRepetitionMoves(current, aiVsAiPastRef.current, legalMoves);
    if (legalMoves.length && !allowedMoves.length) {
      setAiVsAiAutoPlay(false);
      setAiVsAiMsg(AI_REPEAT_END_MESSAGE);
      return;
    }
    const r = recommendMoveFair(current);
    if (!r.move) {
      const winSide = current.turn === 'red' ? 'black' : 'red';
      const winStatus = winSide === 'red' ? 'red_win' : 'black_win';
      setAiVsAiState({ ...current, status: winStatus });
      setAiVsAiMsg((winSide === 'red' ? '紅方' : '黑方') + '困斃對方，勝！');
      playEndgameSound();
      return;
    }
    const next = applyMove(current, r.move.from, r.move.to);
    const nextPast = [...aiVsAiPastRef.current, current];
    aiVsAiPastRef.current = nextPast;
    setAiVsAiPast(nextPast);
    setAiVsAiState(next);
    playBoardSoundFeedback({ captured: !!r.move.captured, check: false });
  }

  function saveAiVsAiRecord() {
    const initial = aiVsAiInitial;
    if (!initial) { setAiVsAiMsg('請先開始一局 AI 對局'); return; }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const title = `AI VS AI ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const record = { ...createGameRecord({ title, moves: aiVsAiStateRef.current.history, finalStatus: aiVsAiStateRef.current.status, redPlayer: 'AI 紅方', blackPlayer: 'AI 黑方' }), initialState: initial };
    const ok = saveGameRecord(storage(), record);
    setAiVsAiMsg(ok ? '棋譜已儲存至打譜模式' : '儲存失敗');
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
    if (shouldPlayEndgameSound(lastSoundStatus, state.status) && !isPlayTimeoutRef.current) playEndgameSound();
    if (lastSoundStatus !== state.status) setLastSoundStatus(state.status);
  }, [lastSoundStatus, state.status]);

  /* 回放步數音效：step 變化時播一次，跳到第 0 步不播，不在回放模式時不播 */
  useEffect(() => {
    const prev = playbackSoundStepRef.current;
    playbackSoundStepRef.current = playbackStep;
    if (prev < 0 || playbackStep === 0 || !playbackRecord || mode !== 'records') return;
    const moveIdx = playbackStep - 1;
    if (moveIdx >= playbackRecord.moves.length) return;
    const move = playbackRecord.moves[moveIdx];
    const isEndgame = playbackState.status === 'red_win' || playbackState.status === 'black_win';
    playBoardSoundFeedback({
      captured: !!move.captured,
      /* 只有非絕殺的將軍才叫「將軍」；絕殺時 endgameSound 會說「絕殺」 */
      check: !isEndgame && isInCheck(playbackState.board, playbackState.turn),
    });
    /* 絕殺步：額外播放 endgame / timeout 音效 */
    if (isEndgame) {
      if (playbackRecord?.endReason === 'timeout' && playbackRecord.timeoutSide) {
        playTimeoutSound(playbackRecord.timeoutSide);
      } else {
        playEndgameSound();
      }
    }
  }, [playbackStep, playbackRecord, playbackState, mode]);

  /* ── AI VS AI：同步 state ref ── */
  useEffect(() => { aiVsAiStateRef.current = aiVsAiState; }, [aiVsAiState]);
  useEffect(() => { aiVsAiPastRef.current = aiVsAiPast; }, [aiVsAiPast]);

  /* ── AI VS AI：自動播放 interval ── */
  useEffect(() => {
    if (!aiVsAiAutoPlay) {
      if (aiVsAiIntervalRef.current) { clearInterval(aiVsAiIntervalRef.current); aiVsAiIntervalRef.current = null; }
      return;
    }
    aiVsAiIntervalRef.current = setInterval(() => {
      const current = aiVsAiStateRef.current;
      // 4次重複同一局面则判定和棋
      if (isRepetitionDraw(current, aiVsAiPastRef.current)) {
        setAiVsAiAutoPlay(false);
        setAiVsAiMsg(REPETITION_DRAW_MESSAGE);
        return;
      }
      if (current.history.length >= 300) {
        setAiVsAiAutoPlay(false);
        setAiVsAiMsg('已達手數上限（300 手）');
        return;
      }
      if (current.status !== 'playing') {
        setAiVsAiAutoPlay(false);
        return;
      }
      const legalMoves = getAllLegalMoves(current.board, current.turn);
      const allowedMoves = filterThirdRepetitionMoves(current, aiVsAiPastRef.current, legalMoves);
      if (legalMoves.length && !allowedMoves.length) {
        setAiVsAiAutoPlay(false);
        setAiVsAiMsg(AI_REPEAT_END_MESSAGE);
        return;
      }
      const r = recommendMoveFair(current);
      if (!r.move) {
        setAiVsAiAutoPlay(false);
        const winSide = current.turn === 'red' ? 'black' : 'red';
        const winStatus = winSide === 'red' ? 'red_win' : 'black_win';
        setAiVsAiState({ ...current, status: winStatus });
        setAiVsAiMsg((winSide === 'red' ? '紅方' : '黑方') + '困斃對方，勝！');
        playEndgameSound();
        return;
      }
      const nextPast = [...aiVsAiPastRef.current, current];
      aiVsAiPastRef.current = nextPast;
      setAiVsAiPast(nextPast);
      setAiVsAiState(applyMove(current, r.move.from, r.move.to));
    }, 700);
    return () => { if (aiVsAiIntervalRef.current) { clearInterval(aiVsAiIntervalRef.current); aiVsAiIntervalRef.current = null; } };
  }, [aiVsAiAutoPlay]);

  /* ── AI VS AI：離開模式時清除 interval ── */
  useEffect(() => {
    if (mode !== 'ai-vs-ai') {
      if (aiVsAiIntervalRef.current) { clearInterval(aiVsAiIntervalRef.current); aiVsAiIntervalRef.current = null; }
      setAiVsAiAutoPlay(false);
    }
  }, [mode]);

  /* ── AI VS AI：對局結束時停止並顯示結果 ── */
  useEffect(() => {
    const prev = aiVsAiLastStatusRef.current;
    aiVsAiLastStatusRef.current = aiVsAiState.status;
    if (!aiVsAiInitial || aiVsAiState.history.length === 0) return;
    if (aiVsAiState.status === 'red_win') {
      setAiVsAiAutoPlay(false);
      setAiVsAiMsg('紅方勝！');
      if (shouldPlayEndgameSound(prev, aiVsAiState.status)) playEndgameSound();
    } else if (aiVsAiState.status === 'black_win') {
      setAiVsAiAutoPlay(false);
      setAiVsAiMsg('黑方勝！');
      if (shouldPlayEndgameSound(prev, aiVsAiState.status)) playEndgameSound();
    }
  }, [aiVsAiState.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play mode：自動存檔（每手 + 結束時） ── */
  useEffect(() => {
    if (mode !== 'play' || !playAutoSaveInitial || playTimeoutSide !== null) return;
    if (state.history.length === 0) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const title = `對局 ${dateStr}`;
    const endReason: 'checkmate' | undefined =
      state.status === 'red_win' || state.status === 'black_win' ? 'checkmate' : undefined;
    const base = createGameRecord({
      id: playAutoSaveIdRef.current ?? undefined,
      title,
      moves: state.history,
      finalStatus: state.status,
      redPlayer: '紅方',
      blackPlayer: '黑方',
      endReason,
      redTimeMs,
      blackTimeMs,
    });
    const record = { ...base, initialState: playAutoSaveInitial };
    const ok = saveGameRecord(storage(), record);
    if (ok) {
      playAutoSaveIdRef.current = base.id;
      setPlayAutoSaveMsg('自動儲存');
    }
  }, [state.history.length, state.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play mode：計時（100ms tick） ── */
  useEffect(() => {
    if (mode !== 'play' || !playAutoSaveInitial || playTimeoutSide !== null) {
      if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    if (state.status !== 'playing') {
      if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    playTimerRef.current = setInterval(() => {
      if (state.turn === 'red') setRedTimeMs(t => Math.max(0, t - 100));
      else setBlackTimeMs(t => Math.max(0, t - 100));
    }, 100);
    return () => { if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; } };
  }, [mode, playAutoSaveInitial, playTimeoutSide, state.status, state.turn]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play mode：逾時判定 ── */
  useEffect(() => {
    if (mode !== 'play' || !playAutoSaveInitial || playTimeoutSide !== null) return;
    if (state.status !== 'playing') return;
    if (redTimeMs <= 0) {
      setPlayTimeoutSide('red');
      isPlayTimeoutRef.current = true;
      setState(s => ({ ...s, status: 'black_win' }));
      playTimeoutSound('red');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const title = `對局 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const base = createGameRecord({
        id: playAutoSaveIdRef.current ?? undefined,
        title,
        moves: state.history,
        finalStatus: 'black_win',
        redPlayer: '紅方',
        blackPlayer: '黑方',
        endReason: 'timeout',
        timeoutSide: 'red',
        redTimeMs: 0,
        blackTimeMs,
      });
      saveGameRecord(storage(), { ...base, initialState: playAutoSaveInitial });
      if (!playAutoSaveIdRef.current) playAutoSaveIdRef.current = base.id;
    }
  }, [redTimeMs]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'play' || !playAutoSaveInitial || playTimeoutSide !== null) return;
    if (state.status !== 'playing') return;
    if (blackTimeMs <= 0) {
      setPlayTimeoutSide('black');
      isPlayTimeoutRef.current = true;
      setState(s => ({ ...s, status: 'red_win' }));
      playTimeoutSound('black');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const title = `對局 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const base = createGameRecord({
        id: playAutoSaveIdRef.current ?? undefined,
        title,
        moves: state.history,
        finalStatus: 'red_win',
        redPlayer: '紅方',
        blackPlayer: '黑方',
        endReason: 'timeout',
        timeoutSide: 'black',
        redTimeMs,
        blackTimeMs: 0,
      });
      saveGameRecord(storage(), { ...base, initialState: playAutoSaveInitial });
      if (!playAutoSaveIdRef.current) playAutoSaveIdRef.current = base.id;
    }
  }, [blackTimeMs]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Play mode：離開時清除計時器 ── */
  useEffect(() => {
    if (mode !== 'play') {
      if (playTimerRef.current) { clearInterval(playTimerRef.current); playTimerRef.current = null; }
    }
  }, [mode]);

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
        {aiMasterNote
          ? <p style={{textAlign:'center',color:'#86efac',fontSize:13,margin:'4px 0 6px'}}>{aiMasterNote}</p>
          : <p style={{textAlign:'center',color:'#94a3b8',fontSize:13,margin:'4px 0 6px'}}>目前盤面</p>
        }
        {renderEndgameBanner()}
        {renderCorrectionPanel()}
        <Board
          board={state.board}
          selected={selected}
          legalMoves={legalMoves}
          moves={state.history}
          lastMove={state.history[state.history.length - 1] ?? null}
          onSquareClick={click}
          onSquareLongPress={openCorrection}
        />
        <div className="toolbar" style={{marginTop:6,flexWrap:'wrap',gap:6}}>
          <button onClick={undo} disabled={!past.length}>回到上一步</button>
          <button onClick={() => { setState(newGame()); setPast([]); setSelected(null); closeCorrection(); setAiMasterNote(null); }}>回到初始局面</button>
          <button onClick={() => setAnalyzeVersion(v => v + 1)}>重新分析</button>
          {aiMasterNote && <button onClick={() => setAiMasterNote(null)}>清除提示</button>}
        </div>
        {analysisSource && analysisMoves.length > 0 && (
          <div className="toolbar" style={{marginTop:6}}>
            <button onClick={saveAnalysisVariation}>儲存為變化</button>
          </div>
        )}
        {analysisSource && (
          <p style={{textAlign:'center',color:'#94a3b8',fontSize:12,margin:'4px 0'}}>
            第 {analysisSource.baseStep} 手變化：{analysisMoves.length} 手
          </p>
        )}
        {analysisMsg && <p style={{textAlign:'center',color:'#86efac',fontSize:13,margin:'4px 0'}}>{analysisMsg}</p>}
        <AiPanel version={analyzeVersion} state={state} />
        <WisdomPanel />
      </main>
    );
  }

  /* ══════════════════════════════════════════
     人 vs AI 測試模式
  ══════════════════════════════════════════ */
  if (mode === 'human-vs-ai') {
    return <HumanVsAiPanel onHome={goHome} storage={storage()} />;
  }

  /* ══════════════════════════════════════════
     AI VS AI 模式
  ══════════════════════════════════════════ */
  if (mode === 'ai-vs-ai') {
    const avaMoveCount = aiVsAiState.history.length;
    const avaIsPlaying = aiVsAiState.status === 'playing';
    const avaTurnText = aiVsAiState.turn === 'red' ? '紅方' : '黑方';
    const avaStatusText = !aiVsAiInitial
      ? '按「新開 AI 對局」開始'
      : aiVsAiState.status === 'red_win' ? '紅方勝'
      : aiVsAiState.status === 'black_win' ? '黑方勝'
      : `第 ${avaMoveCount + 1} 手｜輪到${avaTurnText}`;
    return (
      <main>
        <header>
          <button className="homeButton" onClick={goHome}>回首頁</button>
          <h1>AI VS AI 模式</h1>
          <span className="statusText">{avaStatusText}</span>
        </header>
        {aiVsAiMsg && (
          <p style={{textAlign:'center',color:'#86efac',fontSize:13,margin:'4px 0 6px'}}>{aiVsAiMsg}</p>
        )}
        {aiVsAiInitial ? (
          <Board
            board={aiVsAiState.board}
            selected={null}
            legalMoves={[]}
            moves={aiVsAiState.history}
            lastMove={aiVsAiState.history[aiVsAiState.history.length - 1] ?? null}
            onSquareClick={() => {}}
          />
        ) : (
          <p style={{textAlign:'center',color:'#94a3b8',margin:'32px 0',fontSize:15}}>
            點擊「新開 AI 對局」讓 AI 開始自動對弈
          </p>
        )}
        <div className="toolbar" style={{marginTop:8,flexWrap:'wrap',gap:6}}>
          <button onClick={startAiVsAiGame}>新開 AI 對局</button>
          {aiVsAiInitial && avaIsPlaying && (
            <button onClick={aiVsAiStep} disabled={aiVsAiAutoPlay}>AI 走一步</button>
          )}
          {aiVsAiInitial && avaIsPlaying && (
            <button onClick={() => setAiVsAiAutoPlay(v => !v)}>
              {aiVsAiAutoPlay ? '暫停' : '自動播放'}
            </button>
          )}
          {aiVsAiInitial && (
            <button onClick={saveAiVsAiRecord}>儲存棋譜</button>
          )}
        </div>
        {aiVsAiInitial && (
          <p style={{textAlign:'center',color:'#64748b',fontSize:12,marginTop:6}}>
            共 {avaMoveCount} 手｜上限 300 手
          </p>
        )}
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
            <button className="recordLibCard" onClick={() => { setRecordsList(loadGameRecords(storage())); setRecordsPage('favorites'); }}>
              <div>
                <strong>我的收藏</strong>
                <br /><em>標記收藏的棋譜</em>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="recordLibBadge">{recordsList.filter(r => r.favorited).length}</span>
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

    /* ── 大師棋譜（空狀態） ── */
    if (recordsPage === 'masters') {
      return (
        <main>
          <header>
            <button className="homeButton" onClick={() => setRecordsPage('library')}>返回</button>
            <h1>大師棋譜</h1>
          </header>
          <div className="panel emptyModePanel">
            <p>大師棋譜即將上線，敬請期待。</p>
          </div>
        </main>
      );
    }

    /* ── 我的收藏 ── */
    if (recordsPage === 'favorites') {
      const favRecords = recordsList.filter(r => r.favorited);
      return (
        <main>
          <header>
            <button className="homeButton" onClick={() => setRecordsPage('library')}>返回</button>
            <h1>我的收藏</h1>
          </header>
          <div className="recordsListPage">
            {favRecords.length === 0 ? (
              <div className="panel emptyModePanel"><p>尚無收藏棋譜。在最近對局中點擊 ☆ 可加入收藏。</p></div>
            ) : (
              <div className="recordsItems">
                {favRecords.map(record => (
                  <div key={record.id} style={{position:'relative'}}>
                    <button className="recordsItem" onClick={() => openPlayback(record)}>
                      <span className="recordsItemTitle">{record.title}</span>
                      <span className="recordsItemMeta" style={{color:'#94a3b8',fontSize:12}}>{record.redPlayer ?? '紅方'} vs {record.blackPlayer ?? '黑方'}</span>
                      <span className="recordsItemDate">{fmtDate(record.createdAt)}</span>
                      <span className="recordsItemMeta">{record.moveCount} 手</span>
                      <span className={`recordsItemResult ${resultClass(record.finalStatus)}`}>
                        {resultText(record.finalStatus)}
                      </span>
                    </button>
                    <button
                      className="recordsStarBtn"
                      style={{position:'absolute',right:8,top:8,fontSize:16,background:'none',border:'none',cursor:'pointer',color:'#fbbf24'}}
                      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); toggleFavorite(record.id); }}
                    >★</button>
                    <button
                      className="recordsDeleteBtn"
                      style={{position:'absolute',right:8,bottom:8}}
                      onClick={() => deleteRecord(record.id)}
                    >刪除</button>
                  </div>
                ))}
              </div>
            )}
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
              <div style={{display:'flex',gap:6,marginTop:4}}>
                <input
                  value={saveRedPlayer}
                  onChange={(e: { target: { value: string } }) => setSaveRedPlayer(e.target.value)}
                  placeholder="紅方名稱"
                  style={{flex:1}}
                />
                <input
                  value={saveBlackPlayer}
                  onChange={(e: { target: { value: string } }) => setSaveBlackPlayer(e.target.value)}
                  placeholder="黑方名稱"
                  style={{flex:1}}
                />
              </div>
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
                    <span className="recordsItemMeta" style={{color:'#94a3b8',fontSize:12}}>{record.redPlayer ?? '紅方'} vs {record.blackPlayer ?? '黑方'}</span>
                    <span className="recordsItemDate">{fmtDate(record.createdAt)}</span>
                    <span className="recordsItemMeta">{record.moveCount} 手</span>
                    <span className={`recordsItemResult ${resultClass(record.finalStatus)}`}>
                      {resultText(record.finalStatus)}
                    </span>
                  </button>
                  <button
                    className="recordsStarBtn"
                    style={{position:'absolute',right:48,bottom:8,fontSize:16,background:'none',border:'none',cursor:'pointer',color: record.favorited ? '#fbbf24' : '#64748b'}}
                    onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); toggleFavorite(record.id); }}
                  >{record.favorited ? '★' : '☆'}</button>
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
      const stepVariations = playbackRecord.variations?.filter(variation => variation.baseStep === playbackStep) ?? [];
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
                  <span style={{fontSize:13,color:'#94a3b8'}}>{playbackRecord.redPlayer ?? '紅方'} vs {playbackRecord.blackPlayer ?? '黑方'}</span>
                  <br />
                  <em>
                    {resultText(playbackRecord.finalStatus)}
                    {playbackRecord.endReason === 'timeout'
                      ? `（${playbackRecord.timeoutSide === 'red' ? '紅方' : '黑方'}時間到）`
                      : playbackRecord.finalStatus !== 'playing' ? '（絕殺）' : ''}
                  </em>
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
                lastMove={playbackState.history[playbackState.history.length - 1] ?? null}
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
              {stepVariations.length > 0 && (
                <div className="panel" style={{maxHeight:'none',padding:'10px 12px',marginBottom:10}}>
                  <h3 style={{marginBottom:8}}>變化線</h3>
                  {stepVariations.map(variation => (
                    <button
                      key={variation.id}
                      className="recordLibCard"
                      style={{width:'100%',marginBottom:6}}
                      onClick={() => openVariationPlayback(variation)}
                    >
                      <div>
                        <strong>{variation.title}</strong>
                        <br />
                        <em>{variation.moves.length} 手</em>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
  const redTimeFmt = fmtMs(redTimeMs);
  const blackTimeFmt = fmtMs(blackTimeMs);
  const playIsTimeout = playTimeoutSide !== null;
  const playGameStarted = !!playAutoSaveInitial;

  return (
    <main>
      {renderHeader('一般揭棋模式')}

      {endgameFeedback && (
        <div className={`endgameBanner ${endgameFeedback.winner}`}>
          <strong>{playIsTimeout ? '時間到' : endgameFeedback.title}</strong>
          <span>{endgameFeedback.winnerText}{playIsTimeout ? '（超時）' : ''}</span>
          <small>本局結束</small>
        </div>
      )}
      {playAutoSaveMsg && !playIsTimeout && (
        <p style={{textAlign:'center',color:'#86efac',fontSize:11,margin:'2px 0'}}>{playAutoSaveMsg}</p>
      )}
      {repeatError && (
        <div className="panel syncPanel syncError" style={{marginBottom:'12px'}}>{repeatError}</div>
      )}
      <div className="toolbar">
        <button onClick={startNewPlayGame}>新局</button>
        <button onClick={toggleSyncMode} disabled={state.status !== 'playing'}>{syncMode ? '取消同步' : '同步上一手'}</button>
        <button onClick={undo} disabled={!past.length || state.status !== 'playing'}>回到上一步</button>
      </div>
      {syncMode && (
        <div className={`panel syncPanel ${syncError ? 'syncError' : ''}`} style={{marginBottom:'12px'}}>
    
          {syncError || (syncFrom ? '同步上一手：請點終點' : '同步上一手：請點起點')}
        </div>
      )}
      {/* 正式對局：計時器 chips 貼在棋盤角落，不傳 onSquareLongPress */}
      <div style={{position:'relative',display:'inline-block',width:'100%'}}>
        <Board board={state.board} selected={selected} syncFrom={syncFrom} legalMoves={legalMoves} moves={state.history} lastMove={state.history[state.history.length - 1] ?? null} onSquareClick={click} />
        {playGameStarted && (
          <>
            <div className={`playTimerChip playTimerBlack${blackTimeMs <= 30000 ? ' playTimerWarn' : ''}`}>
              黑 {blackTimeFmt}
            </div>
            <div className={`playTimerChip playTimerRed${redTimeMs <= 30000 ? ' playTimerWarn' : ''}`}>
              紅 {redTimeFmt}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
