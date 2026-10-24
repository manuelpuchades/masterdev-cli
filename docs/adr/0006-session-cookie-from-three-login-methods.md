# The session cookie, obtained by Browser import, Password login or a Pasted cookie

Every authenticated read needs the `fem_auth_mod` cookie, the one the website itself uses. People sign in to Master.dev with a password, Google or GitHub. The CLI can't complete Google or GitHub sign-in itself: those OAuth apps belong to Master.dev and send the callback to master.dev, never to us. So `masterdev auth login` offers three Login methods:

1. **Browser import** (default): read the cookie from a browser where the learner is already signed in. Chromium browsers (Chrome, Arc, Brave, Edge, Chromium, Vivaldi) keep it encrypted in an SQLite file with a key in the OS keychain, which macOS asks the learner to allow once; Firefox keeps it in plain SQLite. Works whatever they sign in with.
2. **Password login**: the CLI posts the site's own login form (`POST /login/`) with email and password.
3. **Pasted cookie**: the value or a `Cookie:` header, as a fallback.

When a session expires the CLI renews it with the same method: a Browser import imports again, a Password login signs in again with the password kept in the keychain (ADR 0007), and a Pasted cookie can't renew, so the command fails with `auth_required` for the agent to ask the learner.

## Considered Options

- **Pasted cookie only** (what `wallapop-cli` does, after rejecting password login in its ADR 0001): simplest, but the learner has to dig into DevTools every time the session expires.
- **Driving a browser for the learner to sign in:** works for GitHub, but Google often refuses sign-in in automated browsers.
- **Safari import:** its cookies need Full Disk Access; left out for now.
