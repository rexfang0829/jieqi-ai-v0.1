import { useState } from 'react';
import type { Piece, PieceType, Position, Side } from '../types/chess';
import type { PieceDraft } from '../game/boardEditing';
import { editorPieceTypeNames } from '../game/pieceText';

const pieceTypes: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'cannon', 'pawn', 'king'];
const sides: Side[] = ['red', 'black'];

const labels: Record<PieceType, string> = editorPieceTypeNames;

const sideLabels: Record<Side, string> = {
  red: '紅方',
  black: '黑方',
};

export function PositionEditor({
  selected,
  piece,
  onUpdatePiece,
  onCreatePiece,
  onClearSquare,
}: {
  selected: Position | null;
  piece: Piece | null;
  onUpdatePiece: (patch: Partial<Piece>) => void;
  onCreatePiece: (draft: PieceDraft) => void;
  onClearSquare: () => void;
}) {
  const [draft, setDraft] = useState<PieceDraft>({ side: 'red', originalType: 'rook', realType: 'rook', revealed: false });

  if (!selected) {
    return (
      <div className="panel editorPanel">
        <h3>局面編輯</h3>
        <p>選取格子後，可新增棋子或調整棋子。</p>
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="panel editorPanel">
        <h3>局面編輯</h3>
        <p>目前選取：{selected.row},{selected.col} 空格</p>
        <PieceForm
          piece={draft}
          onChange={setDraft}
          submitLabel="新增棋子"
          onSubmit={() => onCreatePiece(draft)}
        />
      </div>
    );
  }

  return (
    <div className="panel editorPanel">
      <h3>局面編輯</h3>
      <p>位置：{selected.row},{selected.col}</p>
      <p>外觀走法：{labels[piece.originalType]} / 真實：{labels[piece.realType]}</p>
      <PieceForm
        piece={piece}
        onChange={next => onUpdatePiece(next)}
        submitLabel=""
      />
      <button onClick={onClearSquare}>清除此格</button>
    </div>
  );
}

function PieceForm({
  piece,
  onChange,
  submitLabel,
  onSubmit,
}: {
  piece: PieceDraft;
  onChange: (patch: PieceDraft) => void;
  submitLabel: string;
  onSubmit?: () => void;
}) {
  const draft = {...piece};

  function update(patch: Partial<PieceDraft>) {
    onChange({...draft, ...patch});
  }

  return (
    <>
      <label>
        陣營
        <select value={piece.side} onChange={(e: { target: { value: string } }) => update({ side: e.target.value as Side })}>
          {sides.map(side => <option key={side} value={side}>{sideLabels[side]}</option>)}
        </select>
      </label>
      <label>
        外觀走法 originalType
        <select value={piece.originalType} onChange={(e: { target: { value: string } }) => update({ originalType: e.target.value as PieceType })}>
          {pieceTypes.map(type => <option key={type} value={type}>{labels[type]}</option>)}
        </select>
      </label>
      <label>
        真實棋種 realType
        <select value={piece.realType} onChange={(e: { target: { value: string } }) => update({ realType: e.target.value as PieceType })}>
          {pieceTypes.map(type => <option key={type} value={type}>{labels[type]}</option>)}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={piece.revealed}
          onChange={(e: { target: { checked: boolean } }) => update({ revealed: e.target.checked })}
        />
        已翻開
      </label>
      {onSubmit && <button onClick={onSubmit}>{submitLabel}</button>}
    </>
  );
}
