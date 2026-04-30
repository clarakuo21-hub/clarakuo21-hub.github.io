# 婚禮邀請網站 — 程式碼交接說明文件

> 給新進工程師的完整交接文件。本專案是一個部署在 Vercel 的靜態婚禮邀請網站，搭配少量 Serverless Functions 提供 RSVP 回覆與留言板功能。

---

## 1. 專案 / 模組總覽

### 解決的問題

這是一個**單頁式婚禮邀請網站**，除了呈現婚禮資訊之外，提供兩個需要後端協作的互動功能：

1. **RSVP 出席回覆** — 賓客填寫姓名、是否出席、出席人數，資料會持久化在雲端，方便主家統計人數。
2. **留言板（Guestbook / 祝福牆）** — 賓客可留下祝福，所有人即時看到已有的祝福，並支援下載純文字版。

### 技術取向

- **前端**：純 HTML / CSS / Vanilla JavaScript，沒有使用任何前端框架，直接部署為靜態網站即可。
- **後端**：使用 **Vercel Serverless Functions**（`/api/*.js`），沒有傳統資料庫。
- **儲存**：所有可變資料（RSVP、留言）都寫入 **Vercel Blob** 物件儲存，而非檔案系統或 SQL DB。
- **部署**：推送到 GitHub 後由 Vercel 自動建置與部署。

### 關鍵設計決策

- **沒有資料庫**：考量婚禮網站是短期、低流量服務，用 Blob 儲存 JSON 檔即可，成本極低、維運幾乎為零。
- **RSVP 使用「一筆一檔」而非「單檔覆寫」**：這是為了避免 Vercel Blob 覆寫後快取延遲導致併發寫入互相覆蓋的問題（見章節 5「潛在坑點」）。
- **Guestbook 仍維持「單檔覆寫」**：因留言流量相較低，風險可控，目前尚未改造。

---

## 2. 系統架構與目錄結構

```
clarakuo21-hub.github.io/
├── index.html                  # 主頁面 HTML，包含所有區塊（倒數、RSVP、留言板等）
├── css_styles.css              # 全站樣式
├── js_main.js                  # 前端互動邏輯（DOM 操作、動畫、API 呼叫）
├── generate-album.js           # 本地工具：掃描相簿資料夾並產生 manifest.js
├── guestbook.txt               # 備用的靜態留言檔（API 無法連線時的 fallback）
├── package.json                # Node 專案設定，主要宣告 @vercel/blob 依賴
├── vercel.json                 # Vercel 部署設定（目前為空 {}，預留未來用途）
│
├── api/                        # Vercel Serverless Functions（每個 .js 就是一個 endpoint）
│   ├── rsvp.js                 # RSVP 主端點：GET 讀取所有回覆；POST 新增回覆
│   ├── rsvp-consolidate.js     # 手動觸發的整併端點：將散落 entry 合併成 rsvp-all.json
│   ├── _rsvp_blob.js           # RSVP 資料層：封裝對 Vercel Blob 的讀寫邏輯
│   ├── guestbook.js            # 留言板主端點：GET 讀取所有留言；POST 新增留言
│   ├── guestbook.txt.js        # 留言板下載端點：把所有留言輸出成純文字檔
│   └── _guestbook_blob.js      # 留言板資料層：封裝對 Vercel Blob 的讀寫邏輯
│
├── asset/                      # 舊版資源資料夾（部分圖片、字型）
└── assets/
    ├── album/                  # 相簿圖片
    │   ├── manifest.js         # 由 generate-album.js 自動產生的圖片清單
    │   └── manifest.json       # JSON 版清單
    └── fonts/                  # 自訂字型
```

### 重要檔案職責一覽

| 檔案 | 職責 |
| --- | --- |
| `index.html` | 所有 UI 與表單結構。RSVP 表單 id 為 `attendance-form`，留言板表單 id 為 `guestbook-form`。 |
| `js_main.js` | 整個前端的行為中樞。以 `DOMContentLoaded` 觸發一系列 `initXxx()` 函式，分別處理倒數、導覽、動畫、RSVP、留言板、相簿輪播等。 |
| `api/rsvp.js` | RSVP 的 HTTP 入口，只負責 HTTP 驗證與格式化；實際的儲存邏輯委派給 `_rsvp_blob.js`。 |
| `api/_rsvp_blob.js` | RSVP 資料層。把新資料寫到 `rsvp-entries/<timestamp>-<uuid>.json`（不可變），讀取時把所有 entry 與舊版 `rsvp.json` 合併。 |
| `api/rsvp-consolidate.js` | 管理端點：呼叫後會把目前所有 RSVP entry 合併寫入 `rsvp-all.json`，內含總人數摘要。 |
| `api/guestbook.js` | 留言板的 HTTP 入口，使用傳統「整份讀 → 整份覆寫」模式寫入單一 blob。 |
| `api/_guestbook_blob.js` | 留言板資料層，含 `guestbook.txt` 的讀寫與解析 / 序列化邏輯。 |
| `generate-album.js` | 本地執行的輔助指令（`npm run album`），用來自動列出 `assets/album` 底下所有圖片，產出前端需要的 manifest。 |

---

## 3. 核心邏輯與資料流

以下挑出三個最核心的函式說明其運作邏輯。

### 3.1 `initAttendance()` — 前端 RSVP 表單

**位置**：`js_main.js`

**功能**：處理 RSVP 表單提交。

**資料流**：

```
使用者填寫表單
      ↓
submit 事件 → 前端驗證（姓名、是否出席必填）
      ↓
POST /api/rsvp (JSON: { name, attending: boolean, guestCount })
      ↓
成功 → 顯示感謝畫面；失敗 → alert 錯誤訊息
```

**關鍵重點**：

- `attending` 送出的是**布林值**（`true` / `false`），不是字串。這點要跟後端的 `safeAttending` 判斷一致。
- 「不參加」時 `guestCount` 強制為 `0`。
- 送出失敗會把按鈕恢復可點狀態，避免卡住。

### 3.2 `writeEntry(entry)` — RSVP 不可變寫入

**位置**：`api/_rsvp_blob.js`

**功能**：把一筆新的 RSVP 資料寫入 Blob 儲存。

**運作邏輯**：

1. 以 `normalizeEntry()` 驗證並正規化欄位（id、name、createdAt 必填；guestCount 轉整數；attending 只接受 `true` / `'yes'`）。
2. 以 `makeEntryPathname(entry)` 組出一個**不會衝突**的檔名：`rsvp-entries/<只含數字的時間戳>-<uuid>.json`。
3. 呼叫 `put(pathname, text, { access: 'public', addRandomSuffix: false })` 寫入 Blob。
4. 若 Blob store 是 private，捕捉錯誤後重試一次 `access: 'private'`。
5. 寫入後清除 5 秒內的讀取快取。

**為什麼這樣設計**（關鍵！）：

> Vercel Blob 對於「覆寫同名檔案」有最長 60 秒的快取延遲。如果所有 RSVP 都寫同一個 `rsvp.json`，在高併發下會出現：
> A 讀到舊版 → A 寫回（含 A 的新資料） → B 讀到仍是舊版（快取未更新） → B 寫回（含 B 的新資料，但覆蓋了 A）

所以改成**每筆一檔、永不覆寫**，讀取時再用 `readEntries()` 合併所有檔案。

### 3.3 `readEntries()` 與 `consolidateEntries()` — 讀取與整併

**位置**：`api/_rsvp_blob.js`

**`readEntries({ forceFresh })` 流程**：

```
（命中記憶體快取 5 秒內？）→ 是 → 直接回傳快取
            ↓ 否
並行執行：
  A. 讀取舊版 rsvp.json（相容舊資料）
  B. list() rsvp-entries/ 底下所有 blob → 逐一 fetch 內容
      ↓
mergeEntries([...A, ...B])：以 id 去重，保留 createdAt 較新的那份
      ↓
依 createdAt 倒序排列 → 存入快取 → 回傳
```

**`consolidateEntries()` 流程**：

1. 強制 `readEntries({ forceFresh: true })` 取得最新所有資料。
2. 算出總計摘要：
   - `totalRsvps`：總回覆數
   - `attendingCount` / `notAttendingCount`：出席 / 不出席人數
   - `totalGuests`：所有出席者的 `guestCount` 總和
3. 寫入 `rsvp-all.json`（這個檔案允許覆寫，因為它是整併結果，不是事實來源）。
4. 回傳 payload。

> **資料統計只要打一次 `GET /api/rsvp-consolidate` 就能拿到**。`rsvp.json`（舊版）、`rsvp-entries/*.json`（新版事實來源）、`rsvp-all.json`（整併快照）三者的角色要分清楚。

---

## 4. 外部依賴與設定

### 第三方套件（`package.json`）

| 套件 | 用途 |
| --- | --- |
| `@vercel/blob` | 讀寫 Vercel Blob 物件儲存，是 RSVP 與留言板唯一的持久層。 |

其他都是原生 Node.js / 瀏覽器 API，無前端框架、無 ORM、無打包工具。

### 環境變數（Env）

| 變數 | 是否必要 | 說明 |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | **必要** | Vercel Blob 的讀寫 token。連結 Blob store 到專案時會自動注入。 |
| `BLOB_STORE_ID` | 選用 | 若一個專案連結多個 Blob store，可指定要用哪一個。 |
| `CRON_SECRET` | 選用 | 若設定，`/api/rsvp-consolidate` 手動呼叫時需帶 `Authorization: Bearer <secret>`。未設定則公開。 |

### 部署 / 設定步驟

1. 把 repo import 到 Vercel，framework preset 選 **Other**。
2. 在 Vercel Dashboard → Storage → 建立或連結 **Blob**，並掛到這個專案上。
3. 重新部署一次（讓 Function 取得 `BLOB_READ_WRITE_TOKEN`）。
4. 驗證：
   - `GET /api/rsvp` 回傳 `{ entries: [...] }`
   - `POST /api/rsvp` 帶 `{ name, attending, guestCount }` 能成功寫入
   - `GET /api/guestbook` 回傳 `{ entries: [...] }`
   - `GET /api/guestbook.txt` 下載純文字版
   - `GET /api/rsvp-consolidate` 回傳總計摘要

### 本地開發工具指令

```powershell
# 掃描 assets/album 底下的圖片並重新產生 manifest.js
npm run album
```

專案沒有自己的 dev server；前端靜態檔可用任何 HTTP server 預覽，Functions 必須用 `vercel dev` 或直接部署到 Vercel 才能測試。

---

## 5. 待辦事項與潛在坑點（Tech Debt）

### 5.1 Guestbook 仍有「覆寫被舊快取覆蓋」的風險

**現況**：`api/guestbook.js` 的 POST 流程是「讀全部 → unshift 新留言 → 整份 `put()` 覆寫」。

**風險**：與 RSVP 原本的問題一樣，兩筆近乎同時送出的留言可能互相覆蓋。

**建議方向**：比照 RSVP 改成每筆一檔（`guestbook-entries/<timestamp>-<uuid>.json`），或採用 `ifMatch` 的條件式寫入（需要升級 `@vercel/blob` 並改寫邏輯）。

### 5.2 `rsvp-all.json` 與事實來源會有時間差

`rsvp-all.json` 是**快照**，不會在每次 POST 時自動更新；只有手動 `GET /api/rsvp-consolidate` 才會重寫。目前 `vercel.json` 已不再設定 cron，如果主家需要每天早上看到最新統計，要自行呼叫這個端點或重新加回 cron。

### 5.3 前端有兩個 RSVP 初始化函式容易混淆

`js_main.js` 同時有 `initRSVPForm()`（走 Formspree）與 `initAttendance()`（走 `/api/rsvp`）。前者僅在 `form.action` 含有 `formspree.io/f/` 時才攔截，一般情況下不會作用，但保留在程式碼中對新進工程師是個誤導點。**建議**：確認不再使用 Formspree 後直接移除 `initRSVPForm`。

### 5.4 沒有單元測試

整份專案沒有測試。RSVP 的 `normalizeEntry` 與 `mergeEntries` 邏輯其實非常適合 pure function 單元測試，建議未來至少為這兩個函式補上 vitest / jest 測試。

### 5.5 錯誤訊息會回傳原始 error.message

`/api/*.js` 的 catch 區塊會把 `error.message` 直接回給前端。婚禮網站對外暴露有限，但若未來改作更正式用途，應過濾敏感訊息。

### 5.6 快取策略只在單一 Function 執行個體內有效

`_rsvp_blob.js` 用 module 層級變數 `entriesCache` 當 5 秒快取。Vercel Serverless 是多實例的，兩台機器的快取獨立、也隨冷啟動失效。目前的設計堪用，但不要誤以為這是全域快取。

### 5.7 `vercel.json` 目前為空

移除 cron 後 `vercel.json` 只剩 `{}`。若未來沒有其他設定需求，可直接刪除此檔；保留亦無害。

### 5.8 檔案命名風格不一致

同一個 repo 中同時存在：
- `css_styles.css` / `js_main.js`（底線）
- `generate-album.js`（破折號）
- `asset/` 與 `assets/`（兩個資料夾幾乎同名）

**建議**：統一風格；`asset/` 與 `assets/` 應合併避免踩雷。

### 5.9 RSVP 送出失敗按鈕文字 inconsistency

`initAttendance` 成功時將按鈕文字設為 `送出中...`，失敗恢復時設為 `送出回复`；但表單原始文字可能是別的。若未來調整 HTML 上的按鈕標籤，要記得同步更新 JS 中的字串常數。

---

## 附錄：常見問題 FAQ

**Q1. 我把 RSVP 刪一筆要怎麼做？**
目前沒有提供刪除 API。最快做法是到 Vercel Dashboard 的 Blob 介面，把對應 `rsvp-entries/...json` 檔刪掉；或寫一次性 script 呼叫 `@vercel/blob` 的 `del()`。

**Q2. 為什麼 `attending: false` 之前會「消失」？**
那是本專案歷史上的 bug。原因是舊版用單一 `rsvp.json` 整份覆寫，被 Blob 快取延遲吃掉最新資料。現在改成「一筆一檔」已經解決，詳見章節 3.2。

**Q3. 留言板為什麼還有 `guestbook.txt` 檔？**
它是 API 不可用時的前端 fallback。`js_main.js` 中的 `loadEntries` 會先打 `/api/guestbook`，失敗才讀這個靜態檔。可以只當作舊資料備份，不需持續維護。
