import { getAllLegalMoves } from '../src/game/checkRules';
import { recommendMove } from '../src/ai/simpleAi';
import { formatAiDebugReport } from '../src/ai/aiDebugReport';
import type { Board, Move, Piece, PieceType, Side } from '../src/types/chess';

function assertOk<T>(value: T): asserts value is NonNullable<T> {
  if (value == null || value === false) throw new Error(`expected truthy, got ${String(value)}`);
}
function assertContains(haystack: string, needle: string) {
  if (!haystack.includes(needle)) throw new Error(`expected report to contain "${needle}"`);
}
function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
}
function piece(side: Side, originalType: PieceType, realType = originalType, revealed = true): Piece {
  return { id: `${side}-${originalType}-${realType}-${String(revealed)}`, side, originalType, realType, revealed };
}
function place(board: Board, row: number, col: number, p: Piece): Board {
  board[row][col] = p; return board;
}
function findMove(board: Board, side: Side, from: [number, number], to: [number, number]): Move {
  const m = getAllLegalMoves(board, side).find(c =>
    c.from.row === from[0] && c.from.col === from[1] && c.to.row === to[0] && c.to.col === to[1]);
  if (!m) throw new Error(`no legal move [${from}]->[${to}]`);
  return m;
}

let ok = 0, fail = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log('ok -', name); ok++; }
  catch (e) { console.log('not ok -', name, (e as Error).message); fail++; }
}

// SG2 debug report: new trace field names appear in formatAiDebugReport output

test('formatAiDebugReport: SG2 fields appear in trace output', () => {
  // Red rook [5,5] threatened by black horse [3,6].
  // Restrict to single escape move [5,5]->[5,0] to avoid checkmate early-return.
  // The recommendation has traces, so fmtTrace is called and new field names appear.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 3, piece('black', 'king'));
  place(board, 5, 5, piece('red', 'rook', 'rook', true));
  place(board, 3, 6, piece('black', 'horse', 'horse', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rookEscape = findMove(board, 'red', [5, 5], [5, 0]);
  const result = recommendMove(state, [rookEscape]);
  assertOk(result.traces);
  assertOk(result.traces.length > 0);

  const report = formatAiDebugReport({ modeName: 'test', state, recommendation: result });

  // Verify new SG2 multi-purpose / damage-control field names appear in the report
  assertContains(report, 'multiPurposeDefense');
  assertContains(report, 'rescuesHighValuePiece');
  assertContains(report, 'rescuesSecondaryPiece');
  assertContains(report, 'blocksHorseFork');
  assertContains(report, 'counterAttacksAttacker');
  assertContains(report, 'forcesOpponentChoice');
  assertContains(report, 'damageControl');
  assertContains(report, 'minimumLossDefense');
  assertContains(report, 'partialDefense');
  assertContains(report, 'unresolvedThreatAfterDefense');
  assertContains(report, 'threatLossBefore');
  assertContains(report, 'threatLossAfter');
  assertContains(report, 'threatLossReduced');
});

console.log(`SG2 mini: ${ok} passed, ${fail} failed`);
