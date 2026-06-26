# ⚠️⚠️⚠️ THIS PLUGIN IS A PORT OF THE ORIGINAL UNDISCORD BY [VICTORNPB](https://github.com/victornpb/) ! ⚠️⚠️⚠️

# ❤️ THE ORIGINAL PROJECT CAN BE FOUND HERE : https://github.com/victornpb/undiscord ❤️

**Vundiscord** is a [Vencord](https://github.com/Vendicated/Vencord) plugin that ports the original [Undiscord](https://github.com/victornpb/undiscord) userscript

## Features
- Bulk delete messages from channels or DMs with fine-grained control
- Filter by Author ID, Server ID, Channel ID
- Search by content, regex pattern, links, files
- Filter by message ID range or date range
- Configurable search and delete delays
- Multiple channel deletion (comma-separated Channel IDs)

## Installation (Desktop Version)
**Prerequiries** : [git](https://git-scm.com/downloads) / [NodeJS](https://nodejs.org/en/download) / [pnpm](https://pnpm.io/installation)
- Open a CMD window, you will need a clone of Vencord's Repository, command : `git clone https://github.com/Vendicated/Vencord`
- Navigate to the path where you cloned the repository and be sure to enter the 'Vencord' folder (Ex : "`cd C:\Documents\Vencord`") then type : `pnpm install --frozen-lockfile`
- Now inside the 'Vencord' Folder, navigate to "`cd .\src\`" and type : "`md userplugins`"
- Navigate to "`cd .\userplugins\`", and clone Vundiscord within : `git clone https://github.com/TetraSsky/vundiscord/`
- Then build : `pnpm build`
- And lastly inject : `pnpm inject` (Select your Discord path (Stable / Canary))

You're now ready to use Vundiscord (be sure to enable it in Vencord's plugin settings) !

## Installation (Web Version)
**⚠️ Be sure to have completed all of the steps above ⚠️**

*You can however exclude both last commands : `pnpm build` & `pnpm inject`, since they're not needed for the web version*

*PS : If you have previously installed the official Vencord extension, you might want to disable/uninstall it to avoid conflicts*

- You will need to build as a web browser extension with : `pnpm buildWeb`
- This will generate a new folder in the main Vencord folder, path : 'Vencord\dist'
- Head on your web browser and open "chrome://extensions" (This can vary depending on your browser)
- Enable "Developer Mode" (*if available/needed*)
- Click on "Load Unpacked" and select the "dist/chromium-unpacked" folder for chromium based browsers or "dist/firefox-unpacked" for Firefox

You're now ready to use Vundiscord, on your browser (same, be sure to enable it in Vencord's plugin settings) !

## Usage

1. Click the trash can icon in Discord's title bar to open Vundiscord
<img alt="Image" src="https://github.com/user-attachments/assets/6e109fbb-120a-45d3-b04d-bed7dfb0446a" />

2. Configure your settings (Author ID, Server ID, Channel ID, filters, delays, etc...)
<img alt="Image" src="https://github.com/user-attachments/assets/8ef531eb-67a9-402b-98c1-05b9fc9a9406" />

3. Click **▶ Delete** to start, *will prompt for confirmation*. (You can Click **⏹ Stop** to abort at any time)
<img alt="Image" src="https://github.com/user-attachments/assets/e502e112-5678-4e21-816c-8618f8b99d11" />

4. Monitor progress via the progress bar and log area
<img alt="Image" src="https://github.com/user-attachments/assets/67da764b-3141-4340-be43-79fbe9127447" />

## Credits
This plugin is built for and requires [Vencord](https://github.com/Vendicated/Vencord), a Discord client mod! Big thanks to them ❤️❤️❤️!

& **victornpb** - Original [Undiscord](https://github.com/victornpb/undiscord) author

## License
MIT License — See [LICENSE](LICENSE) for details.
