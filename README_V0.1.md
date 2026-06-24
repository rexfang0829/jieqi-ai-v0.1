# 大盤揭棋 AI v0.1

這是一個以 React、TypeScript、Vite 製作的大盤揭棋 AI 分析工具原型。

目前版本聚焦 Phase 1：基礎引擎、棋盤、走法生成、將軍/將死判定，以及局面編輯的基礎能力。後續才會進入 Belief State、Monte Carlo、實戰同步與截圖辨識。

## 安裝與啟動

```bash
npm install
npm run dev
```

預設開發網址：

```text
http://localhost:5173
```

## 目前功能

- 9 x 10 棋盤座標，畫面中間有獨立楚河漢界列
- 帥/將起始明子，其餘棋子起始暗子
- 暗子可移動、可吃子、可被吃
- 暗子未翻開時依 `originalType` 走法
- 暗子第一次移動後翻開，之後依 `realType` 走法
- 產生所有合法步，並排除走完後自己被將軍的步
- 判斷將軍、將死、將帥照面
- 撤銷一步
- 基礎局面編輯：選取棋子後可調整真實棋種、明暗狀態、清除棋子
- 簡易 AI 建議，但尚未是完整公平分析器

## 測試

```bash
npm test
npm run build
```

測試涵蓋馬腿、象眼、炮架、兵卒過河、九宮、將帥照面、暗子走法、翻開後走法、將死，以及 AI 不用敵方暗子 `realType` 評分吃子。

## 重要限制

- Belief State 尚未完成
- Monte Carlo 尚未完成
- 30 秒倒數尚未完成
- 天天象棋同步、白點/亮光流程尚未完成
- OCR 與自動截圖辨識尚未開始
- 吃子資訊目前由單一本機狀態保存，尚未完整區分「吃子方知道、被吃方不知道」

## 手機測試 / 線上部署

本專案是 Vite React 專案，建議部署到 Vercel。部署後，手機可以直接用 Vercel 提供的網址測試，不需要同 Wi-Fi，也不需要電腦開著。

詳細步驟請看 `DEPLOYMENT.md`。

部署後，手機可以直接開 Vercel 提供的網址測試最新版本；正式 Build Command 請使用 `npm run build`，詳細設定見 `DEPLOYMENT.md`。
