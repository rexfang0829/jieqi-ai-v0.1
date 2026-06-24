# Deployment

這是 Vite + React + TypeScript 專案，建議部署到 Vercel，方便手機直接用網址測試。

## 建議部署方式：Vercel

1. 到 Vercel，用 GitHub 帳號登入。
2. 選擇 Import Project / Import Repository。
3. 匯入 repository：`rexfang0829/jieqi-ai-v0.1`。
4. Framework 選擇：Vite / React。
5. Build command 設定為：

```bash
npm run build
```

6. Output directory 設定為：

```text
dist
```

7. 完成部署後，Vercel 會提供一個網址。

## 自動重新部署

之後每次 `git push` 到 GitHub，Vercel 會自動重新部署最新版本。

## 手機測試方式

- 用手機瀏覽器打開 Vercel 提供的網址即可。
- 不需要手機和電腦在同一個 Wi-Fi。
- 不需要電腦開著。

## 如果部署失敗

先在本機確認：

```bash
npm run build
```

如果 build 沒過，先修到 build 通過，再重新 push。
