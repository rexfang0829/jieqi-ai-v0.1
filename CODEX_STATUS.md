# Codex Status

## 最新完成的工作

2026-06-25 本輪只做規則 bug 修正與 regression tests。

- 修正暗士 / 暗仕規則：
  - 未翻開且 `originalType=advisor` 時，只能從九宮角位斜進九宮中心。
  - 未翻開暗士不能第一步離宮。
  - 翻開後若 `realType=advisor`，才使用揭棋版明士規則，可全盤斜走一格。
  - 將 / 帥仍維持九宮限制。
- 補上「手動把已翻士改成炮後形成雙炮殺」的 regression test。
- 確認 `applyMove` 後若對方被將死，`status` 會正確更新為 `red_win`。
- 沒有改 UI。
- 沒有改 AI 搜尋。
- 沒有做 Threat Map / Belief State / Monte Carlo / OCR / Ponder。

## 修改了哪些檔案

- `src/game/moveRules.ts`
  - 收窄未翻暗士走法，只允許進九宮中心。
- `tests/rules.test.ts`
  - 更新暗士 / 明士規則測試。
  - 新增雙炮絕殺 status regression test。
- `CODEX_STATUS.md`
  - 更新本輪狀態。
- `NEXT_TASK.md`
  - 更新下一輪建議。

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

## 目前已知限制

- 手機版長按修正棋種尚未做。
- 暗子池 / 棋種數量一致性檢查尚未做。
- 落子音效與絕殺音效優化尚未做。
- Threat Map 尚未做。
- Belief State / Monte Carlo / OCR / Ponder 尚未做。

## 是否已經 push 到 GitHub

本輪測試與 build 通過後，會以 commit `fix advisor rules and checkmate regression` push 到 GitHub。
