# Tracksy hosted mobile app

The interface is the actual Expo Web export from apps/mobile. A retained Sites Vinext runtime serves that unchanged app shell for direct group, expense and authentication routes; it does not supply a second UI.

From the workspace root run npm run export -w @tracksy/mobile. In this checkout run node build.mjs to prepare public assets, then the Sites build helper.

Only static interface assets enter the service-worker cache. Authentication and Supabase data are never cached there. Browser session and selected per-user cache records use encrypted IndexedDB with seven-day expiry and sign-out removal. Restricted browsers fall back to tab memory. Encryption at rest does not protect against same-origin script compromise. Native-only notification, biometric and store APIs remain unavailable in a browser.
