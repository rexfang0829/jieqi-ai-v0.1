import type { GameState, GameStatus, Move } from '../types/chess';
import { moveText } from './moveNotation';

export const GAME_RECORD_VERSION = 1;
export const GAME_RECORD_STORAGE_KEY = 'jieqi.gameRecords.v1';

export type GameRecord = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  moves: Move[];
  finalStatus: Extract<GameStatus, 'playing' | 'red_win' | 'black_win'>;
  moveCount: number;
  note?: string;
  redPlayer?: string;
  blackPlayer?: string;
  favorited?: boolean;
  endReason?: 'checkmate' | 'timeout';
  timeoutSide?: 'red' | 'black';
  redTimeMs?: number;
  blackTimeMs?: number;
  /**
   * The true initial GameState at game start (before move 1), including all
   * hidden-piece realType values. Playback starts from this state and applies
   * moves in order, giving an exact reproduction without randomisation.
   * Old records without this field fall back to snapshots or newGame() replay.
   */
  initialState?: GameState;
  /**
   * @deprecated Kept for backward compatibility with records saved before
   * the initialState strategy. New records use initialState instead.
   */
  snapshots?: GameState[];
};

type GameRecordList = {
  version: 1;
  records: GameRecord[];
};

export type RecordStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function nowIso(): string {
  return new Date().toISOString();
}

function safeStatus(status: GameStatus): GameRecord['finalStatus'] {
  return status === 'red_win' || status === 'black_win' ? status : 'playing';
}

/** Format a stored ISO date string as a local date string for display. */
function fmtLocalDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '時間未知';
    return d.toLocaleString();
  } catch {
    return '時間未知';
  }
}

export function createGameRecord(input: {
  title?: string;
  moves: Move[];
  finalStatus: GameStatus;
  note?: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  redPlayer?: string;
  blackPlayer?: string;
  endReason?: 'checkmate' | 'timeout';
  timeoutSide?: 'red' | 'black';
  redTimeMs?: number;
  blackTimeMs?: number;
}): GameRecord {
  const now = nowIso();
  return {
    version: GAME_RECORD_VERSION,
    id: input.id ?? `record-${Date.now()}`,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    title: input.title?.trim() || '未命名棋譜',
    moves: input.moves,
    finalStatus: safeStatus(input.finalStatus),
    moveCount: input.moves.length,
    note: input.note,
    redPlayer: input.redPlayer?.trim() || undefined,
    blackPlayer: input.blackPlayer?.trim() || undefined,
    endReason: input.endReason,
    timeoutSide: input.timeoutSide,
    redTimeMs: input.redTimeMs,
    blackTimeMs: input.blackTimeMs,
  };
}

export function resultText(status: GameRecord['finalStatus']): string {
  if (status === 'red_win') return '紅方勝';
  if (status === 'black_win') return '黑方勝';
  return '進行中';
}

export function recordToText(record: GameRecord): string {
  const lines = [
    `局名：${record.title}`,
    `時間：${fmtLocalDate(record.createdAt)}`,
    `紅方：${record.redPlayer ?? '紅方'}`,
    `黑方：${record.blackPlayer ?? '黑方'}`,
    `結果：${resultText(record.finalStatus)}${record.endReason === 'timeout' ? `（${record.timeoutSide === 'red' ? '紅方' : '黑方'}時間到）` : ''}`,
    '',
    ...record.moves.map((move, index) => `${index + 1}. ${moveText(move)}`),
  ];
  if (record.note) lines.push('', `備註：${record.note}`);
  return lines.join('\n');
}

export function recordToJson(record: GameRecord): string {
  return JSON.stringify(record, null, 2);
}

function emptyList(): GameRecordList {
  return { version: GAME_RECORD_VERSION, records: [] };
}

export function loadGameRecords(storage?: RecordStorage): GameRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GAME_RECORD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<GameRecordList>;
    if (parsed.version !== GAME_RECORD_VERSION || !Array.isArray(parsed.records)) return [];
    return parsed.records.filter(record => record?.version === GAME_RECORD_VERSION && typeof record.id === 'string');
  } catch {
    return [];
  }
}

export function saveGameRecord(storage: RecordStorage | undefined, record: GameRecord): boolean {
  if (!storage) return false;
  try {
    const records = loadGameRecords(storage);
    const nextRecord = { ...record, updatedAt: nowIso(), moveCount: record.moves.length };
    const index = records.findIndex(item => item.id === record.id);
    if (index >= 0) {
      const existing = records[index];
      records[index] = {
        ...nextRecord,
        createdAt: existing.createdAt,
        favorited: existing.favorited,
        note: nextRecord.note ?? existing.note,
      };
    } else records.unshift(nextRecord);
    storage.setItem(GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavoriteRecord(storage: RecordStorage | undefined, id: string): boolean {
  if (!storage) return false;
  try {
    const records = loadGameRecords(storage);
    const index = records.findIndex(r => r.id === id);
    if (index < 0) return false;
    records[index] = { ...records[index], favorited: !records[index].favorited, updatedAt: new Date().toISOString() };
    storage.setItem(GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
    return true;
  } catch {
    return false;
  }
}

export function deleteGameRecord(storage: RecordStorage | undefined, id: string): boolean {
  if (!storage) return false;
  try {
    const records = loadGameRecords(storage).filter(record => record.id !== id);
    storage.setItem(GAME_RECORD_STORAGE_KEY, JSON.stringify({ ...emptyList(), records }));
    return true;
  } catch {
    return false;
  }
}
