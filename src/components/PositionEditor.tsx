import type { Piece, PieceType, Position } from '../types/chess';

const pieceTypes: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'cannon', 'pawn', 'king'];

const labels: Record<PieceType, string> = {
  king: '帥/將',
  advisor: '仕/士',
  elephant: '相/象',
  rook: '車',
  horse: '馬',
  cannon: '炮',
  pawn: '兵/卒',
};

export function PositionEditor({
  selected,
  piece,
  onUpdatePiece,
  onClearSquare,
}: {
  selected: Position | null;
  piece: Piece | null;
  onUpdatePiece: (patch: Partial<Piece>) => void;
  onClearSquare: () => void;
}) {
  if (!selected) {
    return (
      <div className="panel editorPanel">
        <h3>局面編輯</h3>
        <p>選取棋子後，可調整明暗與真實棋種。</p>
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="panel editorPanel">
        <h3>局面編輯</h3>
        <p>目前選取：{selected.row},{selected.col} 空格</p>
      </div>
    );
  }

  return (
    <div className="panel editorPanel">
      <h3>局面編輯</h3>
      <p>位置：{selected.row},{selected.col}</p>
      <p>外觀走法：{labels[piece.originalType]} / 真實：{labels[piece.realType]}</p>
      <label>
        真實棋種
        <select value={piece.realType} onChange={(e: { target: { value: string } }) => onUpdatePiece({ realType: e.target.value as PieceType })}>
          {pieceTypes.map(type => <option key={type} value={type}>{labels[type]}</option>)}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={piece.revealed}
          onChange={(e: { target: { checked: boolean } }) => onUpdatePiece({ revealed: e.target.checked })}
        />
        已翻開
      </label>
      <button onClick={onClearSquare}>清除此格</button>
    </div>
  );
}
