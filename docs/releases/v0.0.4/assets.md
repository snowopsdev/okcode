# v0.0.4 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.0.4`](https://github.com/OpenKnots/okcode/releases/tag/v0.0.4) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.0.4.md](../v0.0.4.md)             |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

After the workflow completes, this release is expected to publish the **Apple Silicon macOS-only** asset set for version `0.0.4`.

## Desktop installers and payloads

| Platform            | Kind          | Expected filename         |
| ------------------- | ------------- | ------------------------- |
| macOS Apple Silicon | DMG           | `OK-Code-0.0.4-arm64.dmg` |
| macOS Apple Silicon | ZIP (updater) | `OK-Code-0.0.4-arm64.zip` |

## Electron updater metadata

| File             | Purpose                          |
| ---------------- | -------------------------------- |
| `latest-mac.yml` | macOS arm64 update manifest      |
| `*.blockmap`     | Differential download block maps |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or `gh release download` if you use the GitHub CLI.
