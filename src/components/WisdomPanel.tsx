import { useEffect, useState } from 'react';
import { loadWisdom, saveWisdom } from '../storage/wisdomStore';

export function WisdomPanel() {
  const [text, setText] = useState('');
  useEffect(() => setText(loadWisdom()), []);
  return <div className="panel"><h3>心得紀錄</h3><textarea value={text} onChange={e => { setText(e.target.value); saveWisdom(e.target.value); }} placeholder="記錄這盤揭棋的觀察..." /></div>;
}
