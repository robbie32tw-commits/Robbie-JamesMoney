# 劇本庫存系統

管理電子檔與紙本劇本的庫存系統，使用 React + Firebase。

## 功能

- 劇本新增/編輯/刪除，分為「電子檔」與「紙本」兩種格式
- 電子檔可直接上傳 PDF（存於 Firebase Storage），卡片上點擊即可開啟
- 紙本劇本記錄存放位置與數量
- 自訂標籤、搜尋、依格式/標籤篩選
- 匯出 CSV

## 設定

1. 在 [Firebase Console](https://console.firebase.google.com/) 建立專案，啟用：
   - **Firestore Database**
   - **Storage**
2. 複製 `.env.example` 為 `.env`，填入你的 Firebase 設定（Project Settings → 一般設定 → 你的應用程式）
3. 安裝依賴並啟動開發伺服器：

```bash
npm install
npm run dev
```

## Firebase Storage 規則建議

PDF 上傳到 Storage 後，依你的使用情境設定存取規則。若僅自己使用，建議在 Firebase Console 設定需要登入才能讀寫；若不需要驗證機制，至少限制檔案類型與大小：

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /scripts/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 25 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
    }
  }
}
```

## 建置

```bash
npm run build
```
