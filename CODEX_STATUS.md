# Codex Status

## 最新完成的工作

2026-06-25 本輪完成「棋譜系統 MVP」：

- 已新增棋譜資料格式 `GameRecord`。
- 已支援 localStorage 儲存棋譜。
- 已支援讀取已儲存棋譜列表。
- 已支援刪除已儲存棋譜。
- 已支援覆蓋更新同一局棋譜。
- 已支援複製棋譜文字。
- 已支援匯出 JSON。
- 已新增 `GameRecordPanel` 小型棋譜管理區。
- 載入棋譜目前只供查看棋譜文字與基本資訊，不還原盤面。

## 本輪未改動

- 沒有改規則引擎。
- 沒有改 AI 搜尋。
- 沒有改 Move 資料模型。
- 沒有改 board 座標系。
- 沒有做棋譜回放器。
- 沒有做 Belief State。
- 沒有做 Monte Carlo。
- 沒有做 OCR / 自動截圖辨識。
- 沒有做 Ponder。

## 修改了哪些檔案

- `src/App.tsx`
- `src/components/GameRecordPanel.tsx`
- `src/game/gameRecord.ts`
- `src/style.css`
- `tests/rules.test.ts`
- `CODEX_STATUS.md`
- `NEXT_TASK.md`

## npm install 是否完成

完成。

```bash
npm.cmd install
```

## npm test 是否通過

通過。

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- 載入棋譜目前只供查看棋譜，不還原盤面。
- 尚未做棋譜回放器。
- 尚未做 Threat Map。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add game record system mvp` push 到 GitHub。
