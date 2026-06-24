# Codex Status

## 最新完成的工作

本輪完成兩件事：

1. 建立並整理自動交接文件，讓後續每一輪都有清楚狀態與下一步任務。
2. 強化 Phase 1 的基礎局面編輯器，適合從天天象棋局面手動輸入目前盤面。

局面編輯器目前支援：

- 修改棋子陣營：紅方 / 黑方
- 修改 `originalType`
- 修改 `realType`
- 修改明暗狀態 `revealed`
- 清除此格
- 在空格新增棋子
- 清空棋盤
- 恢復初始局面
- 編輯後 `status` 回到 `playing`

## 修改了哪些檔案

- `CODEX_STATUS.md`
  - 記錄目前專案狀態、本輪完成內容、測試結果、限制與 push 狀態。
- `NEXT_TASK.md`
  - 記錄下一輪建議任務、原因、具體功能、禁止範圍與完成標準。
- `tests/rules.test.ts`
  - 補上局面編輯測試：可修改 `originalType`、`realType`、`revealed`。

既有相關功能檔案：

- `src/game/boardEditing.ts`
  - 局面編輯用純函式。
- `src/components/PositionEditor.tsx`
  - 局面編輯 UI。
- `src/App.tsx`
  - 清空棋盤、恢復初始局面、接上局面編輯器。

## npm test 是否通過

通過。

執行指令：

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

執行指令：

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- 尚未完整實作雙方資訊不對稱。
- 尚未建立局面儲存/載入。
- 尚未建立翻子快捷鍵。
- 尚未建立天天象棋手動同步流程。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

本檔案更新時尚未 push；本輪測試與 build 通過後會執行：

```bash
git add .
git commit -m "improve position editor and codex handoff docs"
git push
```

最終 push 結果以本輪回報為準。
