# Chrome 版本更新提醒 Extension

這是一個供公司 Windows 10／11 電腦使用的 Manifest V3 Chrome Extension。它會讀取公司透過 Registry 發佈的最低允許 Chrome 版本及禁止舊版連外日期；當目前 Google Chrome Stable 版本低於門檻時，在一般網頁右上角顯示溫和的更新提醒卡片。

> 本專案只負責提醒。Proxy、防火牆或其他公司網路設備負責實際的外部網路限制。

## 1. 核心功能

- 從 `HKEY_LOCAL_MACHINE` 的 Chrome Extension Managed Storage 政策讀取設定。
- 比較目前 Google Chrome 完整四段式版本；每段可包含前導零，Extension 會先正規化再比較。
- 只有 `MinimumAllowedVersion` 與 `ExternalNetworkBlockDate` 都有效時才自動判斷；任一缺失或無效時自動檢查保持靜默，手動點擊圖示則顯示中性提示。
- 版本過舊時，在目前的一般 HTTP／HTTPS 網頁右上角顯示約 370px 寬的 Shadow DOM 卡片。
- 卡片不開啟新視窗、不遮罩整頁、不搶焦點，使用藍白與淡黃色提醒風格。
- 顯示目前版本、公司建議版本及禁止舊版連外的生效日期。
- 文案依 Chrome UI 語言顯示繁體中文、簡體中文或英文。
- 在不能注入的 `chrome://` 頁面、Chrome 線上應用程式商店或內建檢視器，以工具列 badge 作為備援。
- 使用者關閉卡片或按「8 小時後提醒」後，8 小時內不再顯示。
- 暫停識別綁定「最低版本＋生效日期」，公司變更任一政策時會立即取消舊暫停。
- 每 15 分鐘、Chrome 啟動、政策變更及暫停到期時重新檢查。
- 使用者點擊工具列圖示時會立即檢查；若版本符合，顯示 5 秒的淡綠色合規卡片。
- 可選擇顯示公司更新 SOP 與下載連結。
- 不呼叫公司 API，也不回傳裝置、使用者或瀏覽資料。

## 2. 語言與日期文案

Extension 使用 `chrome.i18n.getUILanguage()` 判斷 Chrome UI 語言：

| Chrome UI 語言 | 卡片語言 |
|---|---|
| `zh-TW`、`zh-HK`、`zh-MO` | 繁體中文 |
| 其他 `zh-*`，以及 `zh` | 簡體中文 |
| 其他語言 | 英文 |

`ExternalNetworkBlockDate` 使用本地年月日比較，不以 `new Date("YYYY-MM-DD")` 解析，因此不會受 UTC 時區偏移影響。日期必須是真實存在的公曆日期；例如 `2028-02-29` 有效，`2027-02-29` 與 `2026-04-31` 無效。

提醒文案依狀態切換：

- **日期未到：** 自指定日期起，過舊 Chrome 將無法連線外部網路。
- **生效當天：** 自今天起將無法連線，並另外顯示完整生效日期。
- **日期已過：** 自指定日期起，過舊 Chrome 已無法連線外部網路。

日期會依語言格式化，例如繁體中文為 `2026年12月31日`，英文為 `December 31, 2026`。

## 3. 支援環境與限制

- Windows 10／11。
- Google 官方下載的 Chrome Stable。
- Manifest V3。
- 不保證支援 Edge、Chromium、Chrome Beta／Dev／Canary、Portable Chrome、macOS、Linux 或 ChromeOS。
- 不判斷更新是否已下載或是否等待重新啟動。
- 不自動重新啟動 Chrome。
- 不強制安裝 Extension；正式部署需另用公司既有的 Chrome Extension 管理政策。
- `chrome.alarms` 可能因休眠或 Chrome 未執行而延後，不保證精準到秒。
- Chrome 不允許 Content Script 注入內部頁面；此時會保留工具列 badge，進入一般網頁後再顯示卡片。

## 4. 專案結構

```text
C:\Code\chrome_version\
├─ manifest.json
├─ managed-schema.json
├─ service-worker.js
├─ content-reminder.js
├─ localization.js
├─ policy-utils.js
├─ version.js
├─ README.md
├─ CHANGELOG.md
├─ _locales\
│  ├─ en\messages.json
│  ├─ zh_TW\messages.json
│  └─ zh_CN\messages.json
├─ backup\
│  └─ chrome-version-extension-1.2.0.snapshot.json
├─ docs\
│  └─ DEPLOYMENT.md
├─ examples\
│  └─ policy-template.reg
├─ scripts\
│  ├─ New-ProjectSnapshot.ps1
│  └─ Restore-ProjectSnapshot.ps1
└─ tests\
   └─ validate.js
```

| 檔案 | 用途 |
|---|---|
| `manifest.json` | Manifest V3、權限、Content Script、i18n 與固定開發 ID |
| `managed-schema.json` | 管理員可透過 Registry 設定的欄位 |
| `service-worker.js` | 讀取政策、取得版本、排程、暫停、badge 與卡片通知 |
| `content-reminder.js` | 建立隔離樣式的 Shadow DOM 右上角提醒卡片 |
| `localization.js` | Chrome UI 語言分類及卡片中／英文文案 |
| `policy-utils.js` | 日期解析、真實年月日驗證、狀態、格式化及政策識別 |
| `version.js` | 四段式版本格式驗證與數字比較 |
| `_locales` | Extension 名稱、說明及工具列標題的 Chrome i18n 資源 |
| `CHANGELOG.md` | `1.0.0` 至 `1.2.0` 的版本歷程及版號規則 |
| `docs\DEPLOYMENT.md` | Registry、網址、上線、完整測試及回復操作手冊 |
| `examples\policy-template.reg` | 測試 Registry 範本 |
| `backup\*.snapshot.json` | 含目錄、Base64 檔案內容、大小及 SHA-256 的專案快照 |
| `scripts\New-ProjectSnapshot.ps1` | 重新產生目前版本的 JSON 專案快照 |
| `scripts\Restore-ProjectSnapshot.ps1` | 從 JSON 還原所有檔案並在寫入前後驗證 SHA-256 |
| `tests\validate.js` | 不依賴 npm 的 JSON、語法、版本、日期、語言與一致性測試 |

## 5. 固定 Extension ID

`manifest.json` 已包含固定公開金鑰。以相同原始碼載入未封裝項目時，Extension ID 應固定為：

```text
bklghhpdljbemdboogebiacbbdknhdli
```

Registry 路徑包含此 ID。載入後請在 `chrome://extensions` 確認畫面顯示相同 ID。Manifest 只包含公開金鑰，不包含私人金鑰。

## 6. Registry 設定

### 6.1 正式路徑

```text
HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\bklghhpdljbemdboogebiacbbdknhdli\policy
```

Extension 不任意存取 Windows Registry。Chrome 會把此企業政策轉成唯讀的 `chrome.storage.managed` 資料。

### 6.2 欄位

| 名稱 | Registry 類型 | 必要性 | 說明 |
|---|---|---:|---|
| `MinimumAllowedVersion` | `REG_SZ` | 必要 | 最低允許四段式 Chrome 版本，例如 `140.0.7339.81`；可使用前導零，例如 `0156.01.02.0003` |
| `ExternalNetworkBlockDate` | `REG_SZ` | 必要 | 禁止舊版 Chrome 連線外部網路的本地日期，格式固定 `YYYY-MM-DD` |
| `SopUrl` | `REG_SZ` | 可選 | 公司更新 SOP 的完整 HTTP 或 HTTPS 網址 |
| `DownloadUrl` | `REG_SZ` | 可選 | 公司核准下載頁的完整 HTTP 或 HTTPS 網址 |

有效提醒政策必須同時具有有效的 `MinimumAllowedVersion` 與 `ExternalNetworkBlockDate`。例如日期空白、格式為 `2026/12/31`、月份為 13 或日期不存在時，Extension 都會清除 badge／舊卡片並保持靜默。

### 6.3 測試範本

範本位於：

```text
C:\Code\chrome_version\examples\policy-template.reg
```

內容：

```reg
Windows Registry Editor Version 5.00

; Chrome security version reminder extension ID: bklghhpdljbemdboogebiacbbdknhdli
; 999.0.0.0 is intentionally high so the alert is displayed during testing.

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\bklghhpdljbemdboogebiacbbdknhdli\policy]
"MinimumAllowedVersion"="999.0.0.0"
"ExternalNetworkBlockDate"="2026-12-31"
"SopUrl"="https://example.com/?page=chrome-update-sop"
"DownloadUrl"="https://example.com/?page=chrome-download"
```

`999.0.0.0` 只用於測試，正式環境請改成公司公告版本。以目前專案測試日期 2026 年 9 月 28 日而言，範例生效日 `2026-12-31` 尚未到期，方便驗證「將無法連線」文案。

### 6.4 PowerShell 建立方式

以系統管理員身分執行：

```powershell
$extensionId = 'bklghhpdljbemdboogebiacbbdknhdli'
$policyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$extensionId\policy"

New-Item -Path $policyPath -Force | Out-Null
New-ItemProperty -Path $policyPath -Name MinimumAllowedVersion -PropertyType String -Value '999.0.0.0' -Force | Out-Null
New-ItemProperty -Path $policyPath -Name ExternalNetworkBlockDate -PropertyType String -Value '2026-12-31' -Force | Out-Null
New-ItemProperty -Path $policyPath -Name SopUrl -PropertyType String -Value 'https://example.com/?page=chrome-update-sop' -Force | Out-Null
New-ItemProperty -Path $policyPath -Name DownloadUrl -PropertyType String -Value 'https://example.com/?page=chrome-download' -Force | Out-Null
```

修改後前往 `chrome://policy` 按「重新載入政策」。

## 7. 開發者模式載入與測試

1. 前往 `chrome://extensions`。
2. 開啟「開發人員模式」。
3. 按「載入未封裝項目」。
4. 選擇 `C:\Code\chrome_version`。
5. 確認 ID 是 `bklghhpdljbemdboogebiacbbdknhdli`。
6. 匯入測試 Registry 範本，前往 `chrome://policy` 重新載入政策。
7. 開啟或切換到任一一般 HTTP／HTTPS 網頁；如果版本低於門檻，右上角應顯示卡片。

如果正在 `chrome://extensions` 等內部頁面，卡片無法注入，工具列 badge 會作為備援：過舊顯示「更新」或 `UPD`，合規顯示綠色「正常」或 `OK`，無法判斷顯示灰色 `?`。進入一般網頁後可再次點擊圖示顯示完整卡片。

點擊工具列圖示會立即重新讀取 Managed Policy 並判斷版本：

- **版本過舊：** 顯示既有更新提醒，並忽略目前的 8 小時暫停以便手動確認。
- **版本符合：** 顯示淡綠色「Chrome 版本符合公司規範」卡片，列出目前版本與最低允許版本，5 秒後自動關閉，也可手動關閉。
- **無法判斷：** 顯示中性的「無法確認 Chrome 版本」卡片，提示確認公司政策是否已載入。

合規與無法判斷卡片都不會寫入 8 小時暫停資料，也不顯示 SOP、下載、禁止連外日期或稍後提醒按鈕。自動排程檢查在版本符合時仍保持靜默，只有使用者主動點擊圖示才顯示合規通知。

## 8. 判斷與暫停規則

```text
目前版本 < 最低允許版本  → 顯示提醒
目前版本 = 最低允許版本  → 不顯示
目前版本 > 最低允許版本  → 不顯示
```

上列「不顯示」適用於自動檢查；使用者主動點擊 Extension 圖示時，等於或高於最低版本會顯示 5 秒合規通知。

版本會先驗證為四段純數字，再以小數點切割並將每段轉成安全整數。前導零會在正規化時移除，例如 `0156.01.02.0003` 會轉成 `156.1.2.3`；比較時逐段使用數字，不使用字串比較。

以下兩個版本會視為完全相同：

```text
0156.01.02.0003
156.1.2.3
```

提醒卡片及暫停政策識別都使用正規化版本。因此只修改前導零，不會被誤認為新的最低版本政策。

使用者按右上角關閉按鈕或「8 小時後提醒」時，Extension 儲存：

- `dismissedPolicyKey`：`MinimumAllowedVersion|ExternalNetworkBlockDate`
- `dismissedUntil`：暫停截止時間

因此下列任一變更都會使舊暫停立即失效：

- `MinimumAllowedVersion` 改變。
- `ExternalNetworkBlockDate` 改變。

8 小時包含 Chrome 關閉、電腦睡眠或關機時間。到期時若 Chrome 沒有執行，會在下次啟動後重新檢查。

## 9. 建議測試案例

### 9.1 顯示卡片

設定 `MinimumAllowedVersion=999.0.0.0` 及有效日期，重新載入政策後切換到一般網頁，應顯示卡片與 badge。

### 9.2 合規版本

將 `MinimumAllowedVersion` 設為 `1.0.0.0`：

1. 自動檢查時應移除更新卡片與 badge，保持靜默。
2. 在一般 HTTP／HTTPS 網頁點擊 Extension 圖示，應顯示淡綠色合規卡片。
3. 卡片應顯示目前版本與最低允許版本，不應顯示日期警告、SOP、下載或 8 小時按鈕。
4. 合規卡片應在 5 秒後自動關閉，也可按右上角按鈕立即關閉。
5. 在 `chrome://extensions` 點擊圖示時，應短暫顯示綠色「正常」或 `OK` badge。

### 9.3 缺少必要欄位

分別刪除 `MinimumAllowedVersion` 或 `ExternalNetworkBlockDate`，每種情況都應完全靜默。

### 9.4 無效日期

依序測試 `2026/12/31`、`2026-13-01`、`2026-04-31`、`2027-02-29`，皆不應顯示。`2028-02-29` 應視為有效日期。

### 9.5 日期狀態

以電腦本地日期為準，將 `ExternalNetworkBlockDate` 分別設為明天、今天與昨天，確認卡片顯示「將無法連線」、「自今天起」及「已無法連線」。

### 9.6 URL 為可選

- 只保留 `SopUrl`：顯示 SOP 按鈕。
- 只保留 `DownloadUrl`：顯示下載按鈕與稍後提醒。
- 兩者都刪除：顯示聯絡資訊單位的說明。
- 使用 `file://`、`javascript:`、相對路徑或錯誤網址：忽略該按鈕。

### 9.7 暫停及政策變更

1. 顯示卡片後按「8 小時後提醒」。
2. 重新載入頁面，卡片與 badge 不應出現。
3. 修改最低版本或生效日期並重新載入 Chrome 政策。
4. 新政策識別不同，應立即重新顯示。

### 9.8 語言

分別以繁體中文、簡體中文及英文 Chrome UI 測試。網頁本身的語言不影響卡片語言。

### 9.9 手動檢查無法判斷

暫時移除必要政策欄位或設定無效日期後重新載入政策：

1. 自動檢查應保持靜默。
2. 在一般網頁點擊 Extension 圖示，應顯示中性的無法確認卡片。
3. 在 Chrome 內部頁面點擊時，應短暫顯示灰色 `?` badge。
4. 關閉此卡片不應建立 8 小時暫停。

## 10. 自動驗證

電腦有 Node.js 時，在專案目錄執行：

```powershell
node tests\validate.js
```

驗證內容包括：

- 所有 JSON 與 JavaScript 語法。
- 四段式版本比較。
- 含前導零版本的解析、正規化與數字比較。
- 閏年及不存在日期。
- 日期未到／當天／已過狀態。
- 繁中／簡中／英文分類及文案。
- 手動點擊的過舊、合規與無法判斷狀態。
- 合規卡片 5 秒自動關閉及工具列 badge 備援。
- Shadow DOM 卡片與 Manifest 權限。
- 固定 Extension ID。
- Managed Schema、Registry 範本及 README 欄位一致性。
- 舊 popup 檔案與 `chrome.windows.create()` 已移除。

此命令不會修改 Registry，也不會啟動或安裝 Extension。

## 11. 疑難排解

### Registry 已設定但不顯示

檢查：

- `MinimumAllowedVersion` 是否為有效四段版本。
- `ExternalNetworkBlockDate` 是否為真實存在的 `YYYY-MM-DD` 日期。
- 目前 Chrome 是否已大於或等於最低版本。
- 是否仍在 8 小時暫停期間。
- 是否位於不能注入卡片的 Chrome 內部頁面；此時查看工具列 badge，並切換到一般網頁。
- 到 `chrome://extensions` 開啟此 Extension 的 Service Worker Console。

### 修改程式碼後既有分頁沒有卡片

新版具備 `scripting` 權限，點擊工具列圖示會嘗試補注入既有 HTTP／HTTPS 分頁；如仍未顯示，重新整理該網頁。Chrome 線上應用程式商店及內部頁面仍禁止注入。

### 連結按鈕未顯示

只接受完整 HTTP 或 HTTPS 網址。空字串、相對路徑、`file://`、`javascript:` 或格式錯誤網址都會被忽略。

## 12. 隱私與權限

本 Extension：

- 不蒐集 Windows 或 Google 帳號。
- 不蒐集瀏覽紀錄、Cookie、表單或網頁內容。
- 不呼叫中央 API，不上傳目前 Chrome 版本。
- 只讀取 Chrome 提供的唯讀 Managed Storage 政策。
- `http://*/*` 與 `https://*/*` 權限只用於在網頁頂層加入本地產生的提醒卡片；Content Script 不讀取或傳送頁面內容。
- `scripting` 只用於 Extension 重新載入後，對已開啟的一般網頁補注入相同提醒程式。
- SOP／下載操作只允許開啟目前 Managed Policy 中設定的 HTTP／HTTPS URL。

## 13. 清除測試政策

以系統管理員身分執行：

```powershell
$extensionId = 'bklghhpdljbemdboogebiacbbdknhdli'
$policyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$extensionId"
Remove-Item -Path $policyPath -Recurse -Force
```

接著到 `chrome://policy` 按「重新載入政策」。Extension 會移除提醒與 badge 並保持靜默。

## 14. 正式上線前檢查

1. 將 `MinimumAllowedVersion` 換成公司正式公告的最低版本。
2. 將 `ExternalNetworkBlockDate` 換成正式生效日期。
3. 將 `SopUrl` 與 `DownloadUrl` 換成公司核准網址。
4. 在代表性的 Windows 10／11 與繁中、簡中、英文 Chrome 測試。
5. 驗證生效日前、當天及生效後文案。
6. 確認低版本 Chrome 被網路設備限制後，SOP 與下載網址仍可存取。
7. 使用公司正式的 Chrome Extension 強制安裝／更新機制部署。

Registry 修改範例、SOP／下載網址替換方式、完整測試矩陣、分階段部署與回復步驟請見：

```text
docs\DEPLOYMENT.md
```

版本功能與版號規則請見：

```text
CHANGELOG.md
```

## 15. JSON 專案快照與 checksum 還原

版本 `1.2.0` 提供單一 JSON 快照：

```text
backup\chrome-version-extension-1.2.0.snapshot.json
```

快照刻意排除 `.git` 與快照 JSON 本身，避免保存 Git 憑證／內部物件及 JSON 自我參照；其餘專案目錄與檔案都會記錄。每個檔案項目包含：

- 相對路徑。
- 原始位元組長度。
- SHA-256 checksum。
- Base64 編碼的完整原始內容。

### 15.1 重新產生快照

程式或文件變更後，在專案根目錄執行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-ProjectSnapshot.ps1
```

### 15.2 還原到新目錄

建議還原到全新空目錄：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\Restore-ProjectSnapshot.ps1 `
  -SnapshotPath .\backup\chrome-version-extension-1.2.0.snapshot.json `
  -DestinationPath C:\Restore\chrome-version-1.2.0
```

還原程式會：

1. 驗證 schema、編碼方式及雜湊演算法。
2. 拒絕絕對路徑、`.`、`..`、路徑穿越及重複／衝突路徑。
3. Base64 解碼後先核對長度與 SHA-256。
4. 寫入檔案。
5. 從磁碟重新讀取並再次核對 SHA-256。

目的地不是空目錄時預設停止。只有確定要覆寫時才加上 `-Force`：

```powershell
.\scripts\Restore-ProjectSnapshot.ps1 `
  -SnapshotPath .\backup\chrome-version-extension-1.2.0.snapshot.json `
  -DestinationPath C:\Restore\chrome-version-1.2.0 `
  -Force
```

還原成功後，請在還原目錄再次執行：

```powershell
node tests\validate.js
```