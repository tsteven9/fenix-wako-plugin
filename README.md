# Fenix

Fenix is a custom Wako add-on that opens movies, TV shows, and episodes directly in **Fen** or **Fenlight** on your Kodi device. It is designed to keep setup simple while giving you a smart in-app picker when both add-ons are enabled. [web:33]

## Features

- Open movies, shows, and episodes from Wako directly in Kodi.
- Supports both **Fen** and **Fenlight**.
- In-app settings inside Wako — no browser needed after install.
- Smart launch behavior:
  - If only **Fen** is enabled, Fenix sends directly to Fen.
  - If only **Fenlight** is enabled, Fenix sends directly to Fenlight.
  - If both are enabled, Fenix asks which add-on to use.
- Optional autoplay support.

## How it works

Fenix builds a `plugin://` URL for the selected Kodi add-on and sends it through Wako to your current Kodi host. Wako add-ons are built from the code under `projects/plugin/src/`, and the final distributable files are published from `dist/`. [web:33]

## Install in Wako

In Wako:

1. Go to **Settings**.
2. Open **Add-ons**.
3. Enable **Unknown Sources** if needed.
4. Choose **Install a third-party add-on**.
5. Paste this URL:

```text
https://raw.githubusercontent.com/tsteven9/fenix-wako-plugin/main/dist/manifest.json
```

Third-party Wako add-ons are commonly installed by sharing a public `manifest.json` URL from GitHub. [web:33][web:132]

## Settings

After installation, open:

**Wako → Settings → Add-ons → Fenix → ⚙**

Available options:

- **Fen**: enable or disable Fen.
- **Fenlight**: enable or disable Fenlight.
- **Autoplay**: skip the source picker and start playback immediately.

## Smart behavior

| Enabled add-ons | Result |
|---|---|
| Fen only | Instantly opens in Fen |
| Fenlight only | Instantly opens in Fenlight |
| Fen + Fenlight | Shows a picker |
| Neither | Shows a warning toast |

## Development

This project follows the Wako add-on structure where the main plugin code lives in:

```text
projects/plugin/src/plugin/plugin.module.ts
```

The entry point is:

```text
projects/plugin/src/main.ts
```

The manifest is:

```text
projects/plugin/src/manifest.json
```

The Wako add-on starter structure and publishing flow are based on the public starter kit and existing addon repos. [web:33][web:29]

## Build

If building locally:

```bash
npm install
npm run build
```

This generates the distributable files in `dist/`, which can then be hosted publicly and installed through Wako using the manifest URL. [web:33]

## GitHub Actions

This repository includes a GitHub Actions workflow that automatically builds the plugin when changes are pushed to the repository. Once the workflow succeeds, the `dist/` output can be used directly for Wako installation.

## Requirements

- Wako on iPhone or Android
- A Kodi host already configured in Wako
- Fen and/or Fenlight installed in Kodi

## Notes

Fenix does not install Fen or Fenlight for you — those Kodi add-ons must already exist on your Kodi setup. Fenix only sends the correct open command from Wako to Kodi.

## License

Personal project / private use unless you choose to add an open-source license.
