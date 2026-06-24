import type { Move } from '../types/chess';
import { pieceName } from '../components/Square';

export function moveText(m: Move): string {
  const side = m.piece.side === 'red' ? '紅' : '黑';
  const name = m.piece.revealed ? pieceName(m.piece) : `暗(${pieceName({...m.piece, realType:m.piece.originalType, revealed:true})}位)`;
  const cap = m.captured ? `，吃${m.captured.side === 'red' ? '紅' : '黑'}${pieceName(m.captured)}` : '';
  const flip = m.flipped ? `，翻出${pieceName({...m.piece, revealed:true})}` : '';
  return `${side}${name}：(${m.from.row},${m.from.col}) → (${m.to.row},${m.to.col})${cap}${flip}`;
}
