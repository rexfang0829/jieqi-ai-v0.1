import { useMemo, useState } from 'react';
import type { GameState, Position } from './types/chess';
import { Board } from './components/Board';
import { MoveList } from './components/MoveList';
import { AiPanel } from './components/AiPanel';
import { WisdomPanel } from './components/WisdomPanel';
import { PositionEditor } from './components/PositionEditor';
import { applyMove, newGame } from './game/gameEngine';
import { getAllLegalMoves } from './game/checkRules';

export default function App() {
  const [state, setState] = useState(() => newGame());
  const [past, setPast] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const legalMoves = useMemo(() => state.status === 'playing' && selected ? getAllLegalMoves(state.board, state.turn).filter(m => m.from.row === selected.row && m.from.col === selected.col).map(m => m.to) : [], [state, selected]);

  const statusText = state.status === 'playing'
    ? `輪到：${state.turn === 'red' ? '紅方' : '黑方'}`
    : state.status === 'red_win'
      ? '紅方勝'
      : state.status === 'black_win'
        ? '黑方勝'
        : '和局';

  function click(pos: Position) {
    if (state.status !== 'playing') {
      setSelected(null);
      return;
    }

    const piece = state.board[pos.row][pos.col];
    if (selected && legalMoves.some(p => p.row === pos.row && p.col === pos.col)) {
      const next = applyMove(state, selected, pos);
      if (next !== state) {
        setPast(history => [...history, state]);
        setState(next);
      }
      setSelected(null);
      return;
    }
    if (piece?.side === state.turn) setSelected(pos);
    else setSelected(null);
  }

  function reset() {
    setState(newGame());
    setPast([]);
    setSelected(null);
  }

  function undo() {
    setPast(history => {
      if (!history.length) return history;
      const previous = history[history.length - 1];
      setState(previous);
      setSelected(null);
      return history.slice(0, -1);
    });
  }

  function editSelectedPiece(patch: Partial<NonNullable<GameState['board'][number][number]>>) {
    if (!selected) return;
    const current = state.board[selected.row][selected.col];
    if (!current) return;
    const board = state.board.map(row => row.map(piece => piece ? {...piece} : null));
    board[selected.row][selected.col] = {...current, ...patch};
    setPast(history => [...history, state]);
    setState({...state, board});
  }

  function clearSelectedSquare() {
    if (!selected || !state.board[selected.row][selected.col]) return;
    const board = state.board.map(row => row.map(piece => piece ? {...piece} : null));
    board[selected.row][selected.col] = null;
    setPast(history => [...history, state]);
    setState({...state, board});
  }

  return (
    <main>
      <header>
        <h1>大盤揭棋 AI v0.1</h1>
        <button onClick={reset}>重新開始</button>
        <button onClick={undo} disabled={!past.length}>回上一步</button>
        <span>{statusText}</span>
      </header>
      <div className="layout">
        <Board board={state.board} selected={selected} legalMoves={legalMoves} onSquareClick={click} />
        <aside>
          <AiPanel state={state} />
          <PositionEditor
            selected={selected}
            piece={selected ? state.board[selected.row][selected.col] : null}
            onUpdatePiece={editSelectedPiece}
            onClearSquare={clearSelectedSquare}
          />
          <MoveList moves={state.history} />
          <WisdomPanel />
        </aside>
      </div>
    </main>
  );
}
