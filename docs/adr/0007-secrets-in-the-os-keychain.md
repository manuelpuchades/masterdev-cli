# Secrets in the OS keychain, with a 0600 file fallback

The session cookie and, for Password login, the password are stored with `@napi-rs/keyring` (macOS Keychain, Secret Service on Linux, Windows Credential Manager) under the service `masterdev-cli`. Where no keychain is reachable (headless Linux, CI) they go to `~/.config/masterdev/secrets.json` with mode 0600. `MASTERDEV_COOKIE` overrides the stored cookie for one-off runs. Non-secret settings (Login method, browser, profile, email) go to `config.json`.

## Considered Options

- **The `security` command on macOS:** no dependency, but macOS-only and the secret travels in the process arguments.
- **A config file only:** portable, but the password would sit in plain text on disk.
