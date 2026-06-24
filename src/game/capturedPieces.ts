import type { Move, Side } from '../types/chess';
import { realPieceName } from './pieceText';

export type CapturedPieceInfo = {
  side: Side;
  kind: 'hidden' | 'revealed';
  name: string;
  label: string;
};

export type CapturedPiecesBySide = Record<Side, {
  hidden: CapturedPieceInfo[];
  revealed: CapturedPieceInfo[];
}>;

export function capturedInfoFromMove(move: Move): CapturedPieceInfo | null {
  if (!move.captured) return null;

  const kind = move.captureKind ?? (move.capturedWasHidden ? 'hidden' : 'revealed');
  const name = realPieceName(move.captured);
  return {
    side: move.captured.side,
    kind,
    name,
    label: kind === 'hidden' ? `暗子（翻出${name}）` : name,
  };
}

export function getCapturedPieces(history: Move[]): CapturedPiecesBySide {
  const result: CapturedPiecesBySide = {
    red: { hidden: [], revealed: [] },
    black: { hidden: [], revealed: [] },
  };

  for (const move of history) {
    const info = capturedInfoFromMove(move);
    if (!info) continue;
    result[info.side][info.kind].push(info);
  }

  return result;
}
