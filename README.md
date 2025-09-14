# 🎥 Google Meet Bot (Recorder + Transcriber)

An automation bot for **Google Meet** built with **Node.js, Express, Puppeteer, Puppeteer-Stream, and Whisper (via Xenova Transformers.js)**.
It can **join meetings, record audio/video, stop recordings, and transcribe them automatically**.

## ✨ Features

* 🔐 Automated Google login (via `.env` credentials)
* 🎥 Join any Google Meet session by meeting code
* 💾 Save recordings as `.mp4`
* ⏹ Stop individual or all meetings
* 📝 Transcribe recordings using **Whisper (local, no API key required)**
* 📡 REST API for external integrations
* ⚡ Manage multiple meetings simultaneously

## 🛠 Tech Stack

* [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
* [puppeteer-extra](https://github.com/berstend/puppeteer-extra) (stealth automation)
* [puppeteer-stream](https://github.com/aleixmorgadas/puppeteer-stream) (media capture)
* [@xenova/transformers](https://xenova.github.io/transformers.js/) (Whisper transcription)
* [ffmpeg](https://ffmpeg.org/) (audio processing)
* [dotenv](https://www.npmjs.com/package/dotenv) (config management)

## ⚙️ Setup

### 1. Clone the repo

### 2. Install dependencies

```bash
npm install
```

### 3. Install ffmpeg

Linux:

```bash
sudo apt update && sudo apt install ffmpeg -y
```

macOS:

```bash
brew install ffmpeg
```

Windows: [Download here](https://ffmpeg.org/download.html)

### 4. Create `.env` file

```env
GOOGLE_EMAIL=your_email_here
GOOGLE_PASSWORD=your_password_here
CHROME_PATH=/usr/bin/google-chrome
PORT=8080
```

⚠️ Use a **dummy Google account**, not your personal one.

### 5. Run the server

```bash
node index.js
```

Server starts on **[http://localhost:8080](http://localhost:8080)**

## 📡 API Endpoints

### ▶️ Join a Meeting

```http
POST /join
```

**Request Body:**

```json
{
    "id": "xxx-xxxx-xxx",
    "isRecording": {
        "audio": true,
        "video": true
    },
    "isStopped": false
}
```

### ⏹ Stop a Meeting

```http
GET /stop/:id
```

### ⏹ Stop All Meetings

```http
GET /stop-all
```

## 📂 Recordings

* Saved in the `recordings/` folder.
* Filenames are timestamped: `1694168883000.mp4`.

## 📝 Transcription

Uses **Whisper (via Xenova Transformers.js)** for offline speech-to-text.

### How it works

1. Converts `.mp4` to `.wav` with **ffmpeg**.
2. Decodes audio with `wav-decoder`.
3. Runs Whisper (`whisper-tiny`) to get text.

### Example

```js
import { getTranscribe } from "./transcribe.js";

(async () => {
  const text = await getTranscribe("recordings/1694168883000.mp4");
  console.log("Transcript:", text);
})();
```

**Sample Output**

```
Transcription result: { text: "Hello everyone, welcome to the meeting." }
```
## 📜 License

MIT License © 2025
