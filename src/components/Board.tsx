import type { Board as BoardType, Position } from '../types/chess';
import { Square } from './Square';

function same(a: Position | null, b: Position): boolean {
  return !!a && a.row === b.row && a.col === b.col;
}

export function Board({ board, selected, legalMoves, onSquareClick }: {
  board: BoardType; selected: Position | null; legalMoves: Position[]; onSquareClick: (pos: Position) => void;
}) {
  function renderCell(piece: BoardType[number][number], r: number, c: number) {
    return (
      <div className={`cellWrap ${c === 8 ? 'rightEdge' : ''} ${r === 9 ? 'bottomEdge' : ''}`} key={`${r}-${c}`}>
        <Square
          piece={piece}
          selected={same(selected, {row:r,col:c})}
          legal={legalMoves.some(p => p.row === r && p.col === c)}
          onClick={() => onSquareClick({row:r,col:c})}
        />
      </div>
    );
  }

  return (
    <div className="boardWrap">
      <div className="boardGrid">
        {board.slice(0, 5).map((row, r) => row.map((piece, c) => renderCell(piece, r, c)))}
        <div className="riverRow"><span>楚河</span><span>漢界</span></div>
        {board.slice(5).map((row, i) => row.map((piece, c) => renderCell(piece, i + 5, c)))}
      </div>
    </div>
  );
}
