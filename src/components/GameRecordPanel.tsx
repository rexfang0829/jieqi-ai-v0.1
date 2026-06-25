import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../types/chess';
import { createGameRecord, deleteGameRecord, loadGameRecords, recordToJson, recordToText, saveGameRecord, type GameRecord } from '../game/gameRecord';

function storage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function GameRecordPanel({ state, past }: { state: GameState; past?: GameState[] }) {
  const [title, setTitle] = useState('未命名棋譜');
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [manualText, setManualText] = useState('');
  const [viewRecord, setViewRecord] = useState<GameRecord | null>(null);

  const currentRecord = useMemo(() => {
    /* 只存 initialState（開局暗子配置），不存每步 snapshots */
    const initialState = past !== undefined ? (past.length > 0 ? past[0] : state) : undefined;
    const base = createGameRecord({
      id: activeId ?? undefined,
      title,
      moves: state.history,
      finalStatus: state.status,
    });
    return initialState ? { ...base, initialState } : base;
  }, [activeId, title, state, past]);

  const displayRecord = viewRecord ?? currentRecord;

  function refresh() {
    setRecords(loadGameRecords(storage()));
  }

  useEffect(() => {
    refresh();
  }, []);

  function saveCurrent() {
    const ok = saveGameRecord(storage(), currentRecord);
    const hasInit = !!currentRecord.initialState;
    setMessage(ok ? (hasInit ? '棋譜已儲存（含初始快照）' : '棋譜已儲存') : '儲存失敗');
    if (ok) {
      setActiveId(currentRecord.id);
      setViewRecord(null);
      refresh();
    }
  }

  async function copyText() {
    const text = recordToText(displayRecord);
    try {
      await navigator.clipboard.writeText(text);
      setManualText('');
      setMessage('棋譜文字已複製');
    } catch {
      setManualText(text);
      setMessage('無法自動複製，請手動複製下方文字');
    }
  }

  function exportJson() {
    const json = recordToJson(displayRecord);
    setManualText(json);
    setMessage('JSON 已產生，可手動複製');
  }

  function loadRecord(record: GameRecord) {
    setViewRecord(record);
    setActiveId(record.id);
    setTitle(record.title);
    setManualText(recordToText(record));
    setMessage('已載入棋譜：只供查看棋譜，不還原盤面');
  }

  function deleteRecord(id: string) {
    const ok = deleteGameRecord(storage(), id);
    setMessage(ok ? '棋譜已刪除' : '刪除失敗');
    if (activeId === id) {
      setActiveId(null);
      setViewRecord(null);
    }
    refresh();
  }

  return (
    <div className="panel recordPanel">
      <h3>棋譜管理</h3>
      <label>
        棋譜標題
        <input value={title} onChange={(event: { target: { value: string } }) => setTitle(event.target.value)} />
      </label>
      <div className="recordActions">
        <button onClick={saveCurrent}>儲存棋譜</button>
        <button onClick={copyText}>複製棋譜文字</button>
        <button onClick={exportJson}>匯出 JSON</button>
      </div>
      {message && <p className="recordMessage">{message}</p>}
      {manualText && <textarea className="recordOutput" readOnly value={manualText} />}
      <p className="recordNotice">載入棋譜目前只供查看棋譜，不還原盤面。</p>
      <div className="recordList">
        <h4>已儲存棋譜</h4>
        {records.length ? records.map(record => (
          <div className="recordItem" key={record.id}>
            <button onClick={() => loadRecord(record)}>{record.title}（{record.moveCount}手）</button>
            <button onClick={() => deleteRecord(record.id)}>刪除</button>
          </div>
        )) : <small>尚無已儲存棋譜</small>}
      </div>
    </div>
  );
}
