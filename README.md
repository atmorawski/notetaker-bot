# Notetaker

Personal notetaker bot for Google Meet built with Node.js, Express, Puppeteer, `puppeteer-stream`, and local Whisper transcription.

Current direction:

- joins Google Meet as a guest
- fills bot display name automatically
- waits to be admitted before starting recording
- stores recordings locally
- supports stop endpoints and local transcription

## Stack

- Node.js
- Express
- `puppeteer-extra` + stealth plugin
- `puppeteer-stream`
- `ffmpeg`
- `@xenova/transformers` for local Whisper transcription

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install `ffmpeg`.

Windows:
[ffmpeg download](https://ffmpeg.org/download.html)

3. Create `.env`:

```env
PORT=8080
BOT_NAME=Andrzej's Notetaker
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
CHROME_USER_DATA_DIR=
FFMPEG_PATH=ffmpeg
AUTO_STOP_MIN_MINUTES=10
AUTO_STOP_CHECK_EVERY_SECONDS=30
AUTO_STOP_SILENCE_WINDOW_SECONDS=15
AUTO_STOP_REQUIRED_SILENT_WINDOWS=3
```

`CHROME_PATH` is optional if Chrome is already discoverable in your environment.
`CHROME_USER_DATA_DIR` can point to a persistent Chrome profile used by the bot.

4. Start the server:

```bash
npm run dev
```

or

```bash
npm start
```

## API

### `POST /join`

Starts the bot and tries to join the meeting as a guest.

Example body with meeting code:

```json
{
  "id": "abc-defg-hij",
  "displayName": "Andrzej's Notetaker",
  "isRecording": {
    "audio": true,
    "video": true
  }
}
```

Example body with full Meet URL:

```json
{
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "displayName": "Andrzej's Notetaker",
  "isRecording": {
    "audio": true,
    "video": true
  }
}
```

### `GET /stop/:id`

Stops a single meeting session and runs transcription for the saved file.

### `GET /stop-all`

Stops all sessions and closes the browser instance.

## Current Notes

- Google account login is no longer part of the intended flow.
- Guest join depends on Google Meet UI labels, so selectors may need small updates over time.
- Recording starts only after admission to the call.
- Auto-stop checks the tail of the recording after the minimum runtime and stops after repeated silent windows.
- After stop, the bot runs ffmpeg fix/compress and then transcribes the processed file.
