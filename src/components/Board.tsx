import type { Board as BoardType, Position } from '../types/chess';
import { BOARD_COLS, BOARD_ROWS, hasLegalPosition, samePosition, visualRowForBoardRow } from '../game/boardLayout';
import { Square } from './Square';

const riverOffset = 0.75;
const visualY = (row: number) => row <= 4 ? row + 0.5 : row + 0.5 + riverOffset;

export function Board({ board, selected, legalMoves, onSquareClick }: {
  board: BoardType; selected: Position | null; legalMoves: Position[]; onSquareClick: (pos: Position) => void;
}) {
  return (
    <div className="boardWrap">
      <div className="boardGrid">
        <svg className="boardLines" viewBox="0 0 9 10.75" aria-hidden="true">
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
                  legal={hasLegalPosition(legalMoves, pos)}
                  onClick={() => onSquareClick(pos)}
                />
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
