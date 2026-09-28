# Chrome 版本更新提醒 Extension 1.2.0 上線手冊

文件日期：2026-09-28

## 1. 上線目標

本 Extension 只提供版本提醒，不負責實際封鎖外部網路。正式上線時需要同時確認：

1. Extension 已透過公司核准方式安裝或強制安裝。
2. Chrome 能讀取 Extension Managed Storage Registry。
3. Proxy、防火牆或其他網路設備會在公告日期執行實際限制。
4. 被限制的舊版 Chrome 仍可存取公司 SOP 與核准下載網址。

固定 Extension ID：

```text
bklghhpdljbemdboogebiacbbdknhdli
```

Extension 版本：

```text
1.2.0
```

## 2. 上線前程式驗證

在 `C:\Code\chrome_version` 執行：

```powershell
node tests\validate.js
```

最後必須看到：

```text
All validation checks passed.
```

在 `chrome://extensions` 重新載入未封裝項目後，確認：

- 名稱為「Chrome 版本更新提醒」。
- 版本為 `1.2.0`。
- ID 為 `bklghhpdljbemdboogebiacbbdknhdli`。
- Service Worker 沒有紅色錯誤。

## 3. Registry 路徑

正式政策路徑：

```text
HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\bklghhpdljbemdboogebiacbbdknhdli\policy
```

PowerShell 路徑：

```text
HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\bklghhpdljbemdboogebiacbbdknhdli\policy
```

所有欄位都是 `REG_SZ`。

| 欄位 | 必要 | 正式值說明 |
|---|---:|---|
| `MinimumAllowedVersion` | 是 | 公司允許的最低 Chrome 四段版本；可有前導零 |
| `ExternalNetworkBlockDate` | 是 | 舊版 Chrome 禁止外部連線的日期，固定 `YYYY-MM-DD` |
| `SopUrl` | 否 | 公司更新步驟頁面，必須是完整 HTTP／HTTPS URL |
| `DownloadUrl` | 否 | 公司軟體中心或核准安裝頁面，必須是完整 HTTP／HTTPS URL |

缺少或無效的必要欄位會讓自動提醒保持靜默。使用者手動點擊圖示時會看到「無法確認 Chrome 版本」。

## 4. 正式修改 Registry

請先準備四個正式值：

```text
最低允許版本：例如 156.1.2.3
禁止連外日期：例如 2026-12-31
SOP 網址：例如 https://intranet.example.com/chrome-update
下載網址：例如 https://software.example.com/chrome
```

以系統管理員 PowerShell 執行：

```powershell
$extensionId = 'bklghhpdljbemdboogebiacbbdknhdli'
$policyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$extensionId\policy"

$minimumVersion = '156.1.2.3'
$blockDate = '2026-12-31'
$sopUrl = 'https://intranet.example.com/chrome-update'
$downloadUrl = 'https://software.example.com/chrome'

New-Item -Path $policyPath -Force | Out-Null
New-ItemProperty -Path $policyPath -Name MinimumAllowedVersion -PropertyType String -Value $minimumVersion -Force | Out-Null
New-ItemProperty -Path $policyPath -Name ExternalNetworkBlockDate -PropertyType String -Value $blockDate -Force | Out-Null
New-ItemProperty -Path $policyPath -Name SopUrl -PropertyType String -Value $sopUrl -Force | Out-Null
New-ItemProperty -Path $policyPath -Name DownloadUrl -PropertyType String -Value $downloadUrl -Force | Out-Null

Get-ItemProperty -Path $policyPath |
  Select-Object MinimumAllowedVersion, ExternalNetworkBlockDate, SopUrl, DownloadUrl
```

若不需要某個可選網址，請刪除該值，不要填入無效協定：

```powershell
Remove-ItemProperty -Path $policyPath -Name SopUrl -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $policyPath -Name DownloadUrl -ErrorAction SilentlyContinue
```

## 5. 版本值解釋

版本必須是四段純數字：

```text
第一段.第二段.第三段.第四段
```

有效範例：

```text
156.1.2.3
0156.01.02.0003
156.0.8037.57
```

`0156.01.02.0003` 會正規化為：

```text
156.1.2.3
```

比較方式是四段安全整數逐段比較，不是字串比較：

```text
156.1.10.3 > 156.1.2.999
```

無效範例：

```text
156.1.2
156.1.2.3.4
v156.1.2.3
156.a.2.3
156.-1.2.3
```

建議正式政策使用 Chrome 顯示的標準四段版本，不需要自行補零；前導零支援主要用來容忍既有資料格式。

## 6. 日期值解釋

`ExternalNetworkBlockDate` 必須是：

```text
YYYY-MM-DD
```

有效：

```text
2026-12-31
2028-02-29
```

無效：

```text
2026/12/31
2026-13-01
2026-04-31
2027-02-29
```

Extension 使用電腦本地年月日比較，不使用 UTC 字串日期解析。

## 7. SOP 與下載網址

只接受完整的 HTTP 或 HTTPS URL：

```text
https://intranet.example.com/chrome-update
https://software.example.com/chrome
```

以下會被忽略：

```text
file:///C:/installer/chrome.exe
javascript:alert(1)
/chrome-update
chrome-update.example.com
```

正式上線前必須在將被限制的舊版 Chrome 上確認：

1. SOP URL 可開啟。
2. Download URL 可開啟。
3. 登入、Proxy 例外、憑證及 DNS 均正常。
4. 網路限制生效後，這兩個網址仍在允許清單內。

## 8. 讓 Chrome 讀取新政策

修改 Registry 不代表 Extension 直接收到 Registry 事件。流程是：

```text
修改 Registry
→ Chrome 載入企業政策
→ chrome.storage.managed 更新
→ Extension 收到 storage.onChanged
→ 重新判斷版本
```

測試時最可靠的操作：

1. 開啟 `chrome://policy`。
2. 按「重新載入政策」。
3. 確認政策頁沒有錯誤。
4. 開啟或重新整理一般 HTTP／HTTPS 網頁。
5. 點擊 Extension 圖示立即檢查。

Service Worker Console 可執行：

```javascript
chrome.storage.managed.get(null).then(console.log)
```

確認顯示的值與 Registry 一致。

## 9. 完整測試矩陣

### 9.1 過舊版本

將最低版本設為高於目前 Chrome，例如：

```reg
"MinimumAllowedVersion"="999.0.0.0"
```

預期：

- 一般網頁右上角顯示更新卡片。
- 顯示目前版本、建議版本及生效日期。
- SOP／下載按鈕依設定出現。
- 工具列顯示橘色「更新」或 `UPD`。

### 9.2 合規版本

將最低版本設為低於目前 Chrome，例如：

```reg
"MinimumAllowedVersion"="1.0.0.0"
```

預期：

- 自動檢查保持靜默。
- 點擊圖示後顯示淡綠色合規卡片。
- 卡片顯示目前版本及最低版本。
- 5 秒後自動關閉。
- 不顯示日期、SOP、下載或 8 小時按鈕。

### 9.3 相等版本

將最低版本設成目前 Chrome 完整版本。預期視為合規。

### 9.4 前導零

設定：

```reg
"MinimumAllowedVersion"="0156.01.02.0003"
```

預期卡片顯示正規化版本 `156.1.2.3`，且與 `156.1.2.3` 比較結果相同。

### 9.5 日期狀態

分別設定本地日期的明天、今天、昨天，確認文案是：

- 將無法連線。
- 自今天起無法連線。
- 已無法連線。

### 9.6 無效政策

逐項測試：

- 刪除 `MinimumAllowedVersion`。
- 刪除 `ExternalNetworkBlockDate`。
- 版本設為 `156.1.2`。
- 日期設為 `2026-13-01`。

預期：自動檢查靜默；手動點擊顯示無法確認卡片或 `?` badge。

### 9.7 8 小時暫停

1. 使用過舊門檻顯示卡片。
2. 按「8 小時後提醒」或關閉更新卡片。
3. 自動檢查不再顯示。
4. 點擊工具列圖示仍可手動查看。
5. 修改最低版本或生效日期後，舊暫停立即失效。

### 9.8 語言

以繁中、簡中、英文 Chrome UI 測試。網頁語言不影響卡片語言。

### 9.9 Chrome 內部頁面

在 `chrome://extensions` 或 `chrome://policy` 點擊圖示：

- 過舊：橘色「更新」或 `UPD`。
- 合規：綠色「正常」或 `OK`。
- 無法判斷：灰色 `?`。

## 10. 分階段上線建議

1. **IT 測試群組**：使用高門檻驗證所有提醒與按鈕。
2. **小量試行群組**：使用接近正式值的政策，確認 Proxy、語言及更新流程。
3. **全公司預告**：設定正式最低版本及未來生效日期。
4. **生效日前確認**：檢查 SOP／下載網址與網路允許清單。
5. **生效當日**：確認日期文案及網路設備規則。
6. **生效後監控**：確認 Help Desk、下載流量及例外裝置。

## 11. 回復方式

### 暫停提醒

刪除其中一個必要政策值即可讓自動提醒靜默，但正式操作建議完整移除 Extension policy：

```powershell
$extensionId = 'bklghhpdljbemdboogebiacbbdknhdli'
$extensionPolicyPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$extensionId"
Remove-Item -Path $extensionPolicyPath -Recurse -Force
```

之後到 `chrome://policy` 重新載入政策。

### 回復程式碼

使用 Git 切回上一個已驗證 tag／commit，或使用專案提供的 JSON 快照：

```powershell
.\scripts\Restore-ProjectSnapshot.ps1 `
  -SnapshotPath .\backup\chrome-version-extension-1.2.0.snapshot.json `
  -DestinationPath C:\Restore\chrome-version-1.2.0
```

還原程式會在寫入前後驗證每個檔案的 SHA-256。