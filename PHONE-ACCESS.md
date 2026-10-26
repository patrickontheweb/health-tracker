# Open Lifestyle Rx from your phone

Open https://lifestylerx.org in Chrome on Android or Safari on iPhone.

1. Choose **Add to home screen** on the page. Android can show an install
   prompt; otherwise use the browser menu. On iPhone use **Share → Add to Home
   Screen**. The icon opens the private log at `/`, starting on today's date.
2. Sign in with your password and select **Remember me** on a personal phone
   to keep the session for up to 30 days.
3. Under **User Settings → Faster sign-in**, choose **Add a passkey** and follow
   the device prompt. Next time a sign-in is needed, enter your username and
   choose **Sign in with a passkey**. Fingerprint, face recognition, or the
   device screen lock can verify the passkey. Password login remains available.

Passkeys belong to the production domain and must be enrolled on the live site.
Local Dev Login does not create production passkeys. Production configuration
enables the Cognito Essentials plan, WebAuthn with required user verification,
and the `USER_AUTH` flow. The infrastructure update must precede app deployment;
deployment reads `PasskeysEnabled` from stack outputs to enable the UI.

Only the generic HTML, JavaScript, styles, manifest, and icons are cached for
faster repeat launches. Configuration, tokens, account details and activity
responses are not stored in the service-worker cache. Remember me stores a
refresh token separately in browser storage as before. Logging requires an
internet connection; failed saves are reported instead of queued silently.

`pnpm build` generates a service worker with a cache version derived from the
built files. Deploy it after the website files with `Cache-Control: no-cache`.
New launches check for updates; a newly installed worker is used on the next
page load. Old hashed website assets remain available during updates.
