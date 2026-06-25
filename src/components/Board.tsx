import type { Board as BoardType, Position } from '../types/chess';
import { BOARD_COLS, BOARD_ROWS, BOTTOM_FILE_LABELS, TOP_FILE_LABELS, hasLegalPosition, samePosition, visualRowForBoardRow } from '../game/boardLayout';
import { Square } from './Square';

const visualY = (row: number) => row + 0.5;
const markerPositions = [
  [2, 1], [2, 7],
  [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
  [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  [7, 1], [7, 7],
] as const;

export function Board({ board, selected, syncFrom = null, legalMoves, onSquareClick, onSquareLongPress }: {
  board: BoardType; selected: Position | null; syncFrom?: Position | null; legalMoves: Position[]; onSquareClick: (pos: Position) => void; onSquareLongPress?: (pos: Position) => void;
}) {
  return (
    <div className="boardWrap">
      <div className="boardShell">
        <div className="fileLabels topFileLabels" aria-hidden="true">
          {TOP_FILE_LABELS.map(label => <span key={label}>{label}</span>)}
        </div>
        <div className="boardGrid">
          <svg className="boardLines" viewBox="0 0 9 10" aria-hidden="true">
            <rect className="outerLine" x="0.5" y={visualY(0)} width="8" height={visualY(9) - visualY(0)} />
            {Array.from({ length: BOARD_ROWS }, (_, row) => (
              <line key={`h-${row}`} x1="0.5" x2="8.5" y1={visualY(row)} y2={visualY(row)} />
            ))}
            {Array.from({ length: BOARD_COLS }, (_, col) => (
              <g key={`v-${col}`}>
                <line x1={col + 0.5} x2={col + 0.5} y1={visualY(0)} y2={visualY(4)} />
                <line x1={col + 0.5} x2={col + 0.5} y1={visualY(5)} y2={visualY(9)} />
              </g>
            ))}
            <line x1="3.5" y1={visualY(0)} x2="5.5" y2={visualY(2)} />
            <line x1="5.5" y1={visualY(0)} x2="3.5" y2={visualY(2)} />
            <line x1="3.5" y1={visualY(7)} x2="5.5" y2={visualY(9)} />
            <line x1="5.5" y1={visualY(7)} x2="3.5" y2={visualY(9)} />
            {markerPositions.map(([row, col]) => (
              <g className="pointMarker" key={`m-${row}-${col}`}>
                {col > 0 && (
                  <>
                    <path d={`M ${col + 0.5 - 0.28} ${visualY(row) - 0.1} h 0.18 v -0.18`} />
                    <path d={`M ${col + 0.5 - 0.28} ${visualY(row) + 0.1} h 0.18 v 0.18`} />
                  </>
                )}
                {col < BOARD_COLS - 1 && (
                  <>
                    <path d={`M ${col + 0.5 + 0.28} ${visualY(row) - 0.1} h -0.18 v -0.18`} />
                    <path d={`M ${col + 0.5 + 0.28} ${visualY(row) + 0.1} h -0.18 v 0.18`} />
                  </>
                )}
              </g>
            ))}
          </svg>
          <div className="riverText" aria-hidden="true"><span>楚河</span><span>漢界</span></div>
          <div className="pointLayer">
            {board.map((row, r) => row.map((piece, c) => {
              const pos = {row: r, col: c};
              return (
                <div
                  className="pointWrap"
                  style={{ gridColumn: c + 1, gridRow: visualRowForBoardRow(r) + 1 }}
                  key={`${r}-${c}`}
                >
                  <Square
                    piece={piece}
                    selected={samePosition(selected, pos)}
                    syncOrigin={samePosition(syncFrom, pos)}
                    legal={hasLegalPosition(legalMoves, pos)}
                    onClick={() => onSquareClick(pos)}
                    onLongPress={() => onSquareLongPress?.(pos)}
                  />
                </div>
              );
            }))}
          </div>
        </div>
        <div className="fileLabels bottomFileLabels" aria-hidden="true">
          {BOTTOM_FILE_LABELS.map(label => <span key={label}>{label}</span>)}
        </div>
      </div>
    </div>
  );
}
