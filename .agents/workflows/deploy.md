---
description: How to deploy the application to Firebase Hosting
---

When the user asks to deploy the application or you are ready to publish changes to Firebase Hosting, YOU MUST ALWAYS follow these steps:

1. Determine exactly what changes were made in this deployment (e.g. bug fixes, new features, UI tweaks).
2. Formulate a concise deployment message explaining the changes (in Traditional Chinese or English).
3. **NEVER** run just `firebase deploy`.
4. **ALWAYS** use the `-m` flag to append the deployment message.
5. Example format: `firebase deploy --only hosting -m "修復了記帳按鈕A與B沒有連動設定名字的問題"` 
6. Explain to the user the changes that you just deployed so they know what to test.
