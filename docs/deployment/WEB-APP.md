# Hosted Tracksy app

Public app: https://tracksy-app.souravsharma191919.chatgpt.site

This is the actual Expo Web export of `apps/mobile`, using the same mobile screens, assets, navigation and Supabase backend as the 0.5.0 Android app. Browser-specific viewport sizing keeps the interface and modal sheets above the keyboard. Desktop uses the existing responsive app layout.

On iPhone, open the link in Safari, choose Share → Add to Home Screen, then open Tracksy from its icon. Android browsers can install through their browser menu. No Apple Developer membership is required for this web installation.

Browser sessions, pending invitations and selected per-user query caches use encrypted IndexedDB records with a non-extractable origin-scoped key, seven-day expiry and sign-out removal. This supersedes the earlier memory-only web behavior. Restricted browsers fall back to tab memory. Encryption at rest does not protect against malicious scripts running on the same origin.

The service worker caches only the static interface and assets. Authentication callbacks and Supabase data requests are never cached there; offline availability does not imply offline financial posting. Native phone notifications, biometric prompts and store purchase APIs remain unavailable on the web. Email invitations/reminders use the existing backend.

Hosting uses a retained Sites Vinext runtime to serve the unchanged app shell for direct group, expense and authentication links. The project identity and public audience are retained. The support/privacy site offers browser invitation/reminder links; its former hostname redirects to the current one.

Checks: all workspace types and 67 tests passed. Chromium and WebKit reviews at 320/390/430px passed sign-in persistence without a login flash, deep-route reloads, fixed action areas, light/dark themes, keyboard-height profile sheets, installation metadata, service-worker activation and sign-out. Local production-runtime checks returned 200 for group/expense routes and the expected MIME types for installation files. Live checks and deployment provenance are recorded in VERIFICATION.md. No physical iPhone was connected.

Current deployment: Site version 3, source `37e768e9f5ba9946c0f4a86c1e4575be0d55d4e5`, deployment `appgdep_6ae74afcdc40819180b2415ed7508ca2`, succeeded on 1 November 2026. The generated public directory is recreated before copying the Expo export so stale static route directories cannot shadow the runtime.

To rebuild, export the mobile app from the workspace root, run `node build.mjs` in `sites/tracksy-web`, then the Sites build/package/publish workflow. Keep all credentials in backend secrets or protected local storage; never copy `.env` or QA accounts into the Site.
