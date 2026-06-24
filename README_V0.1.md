# 大盤揭棋 AI v0.1

## 執行方式

```bash
npm install
npm run dev
```

瀏覽器開啟 Vite 顯示的網址，通常是：

```text
http://localhost:5173
```

## 目前功能

- 9 × 10 中國象棋大盤
- 暗子背面顯示圓圈，視覺風格接近天天象棋方向
- 楚河漢界在兵卒中間的河界區顯示
- 開局暗子真實身份隨機洗牌
- 暗子未翻開時依 originalType 走法
- 暗子第一次移動後翻開為 realType
- 明子依 realType 走法
- 基本走法：將帥、士仕、象相、車、馬、炮、兵卒
- 基本規則：馬腿、象眼、炮架、九宮、兵卒過河、將帥照面
- 簡易 AI 推薦
- 走法紀錄
- 心得 localStorage 儲存

## 下一步

優先補強 checkRules.ts：
- 產生全部合法步
- 排除自殺步
- 完整將軍 / 將死
- 暗子機率 belief engine
