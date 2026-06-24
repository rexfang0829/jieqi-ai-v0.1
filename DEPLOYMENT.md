# Deployment

這是 Vite + React + TypeScript 專案，建議部署到 Vercel。

## Vercel 設定

1. 用 GitHub 登入 Vercel。
2. Import repository：`rexfang0829/jieqi-ai-v0.1`
3. Framework：Vite / React
4. Build Command：`npm run build`
5. Output Directory：`dist`

不要依賴臨時 Build Command。專案已固定 package versions，Vercel 應使用標準 `npm run build`。

## 自動部署

每次 `git push` 到 GitHub 後，Vercel 會自動重新部署。

## 手機測試

部署成功後，用手機瀏覽器直接打開 Vercel 提供的網址即可。

- 不需要同 Wi-Fi。
- 不需要電腦開著。
- 手機看到的就是最新部署版本。

## 部署失敗時

先在本機確認：

```bash
npm install
npm run build
```

如果 build 沒過，先修到 build 通過，再 push 讓 Vercel 重新部署。
