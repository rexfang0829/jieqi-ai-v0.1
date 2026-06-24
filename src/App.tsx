import { useMemo, useState } from 'react';
import type { Position } from './types/chess';
import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { AiPanel } from './components/AiPanel';
import { WisdomPanel } from './components/WisdomPanel';
import { applyMove, newGame } from './game/gameEngine';
import { getAllLegalMoves } from './game/checkRules';

export default function App() {
  const [state, setState] = useState(() => newGame());
  const [selected, setSelected] = useState<Position | null>(null);
  const legalMoves = useMemo(() => selected ? getAllLegalMoves(state.board, state.turn).filter(m => m.from.row === selected.row && m.from.col === selected.col).map(m => m.to) : [], [state, selected]);

  function click(pos: Position) {
    const piece = state.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      setState(s => applyMove(s, selected, pos));
      setSelected(null);
      return;
    }
    if (piece?.side === state.turn) setSelected(pos);
    else setSelected(null);
  }

  return (
    <main>
      <header>
        <h1>大盤揭棋 AI v0.1</h1>
        <button onClick={() => { setState(newGame()); setSelected(null); }}>重新開局 / 重新隨機</button>
        <span>目前輪到：{state.turn === 'red' ? '紅方' : '黑方'}</span>
      </header>
      <div className="layout">
        <Board board={state.board} selected={selected} legalMoves={legalMoves} onSquareClick={click} />
        <aside>
          <AiPanel state={state} />
          <MoveList moves={state.history} />
          <WisdomPanel />
        </aside>
      </div>
    </main>
  );
}
