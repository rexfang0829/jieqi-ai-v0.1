import type { Board as BoardType, Position } from '../types/chess';
import { Square } from './Square';

function same(a: Position | null, b: Position): boolean {
  return !!a && a.row === b.row && a.col === b.col;
}

export function Board({ board, selected, legalMoves, onSquareClick }: {
  board: BoardType; selected: Position | null; legalMoves: Position[]; onSquareClick: (pos: Position) => void;
}) {
  return (
    <div className="boardWrap">
      <div className="boardGrid">
        {board.map((row, r) => row.map((piece, c) => (
          <div className="cellWrap" key={`${r}-${c}`}>
            {r === 4 && c === 1 && <div className="river riverLeft">楚河</div>}
            {r === 4 && c === 5 && <div className="river riverRight">漢界</div>}
            <Square
              piece={piece}
              selected={same(selected, {row:r,col:c})}
              legal={legalMoves.some(p => p.row === r && p.col === c)}
              onClick={() => onSquareClick({row:r,col:c})}
            />
          </div>
        )))}
      </div>
    </div>
  );
}
