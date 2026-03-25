import dotenv from "dotenv";
import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getStream, launch } from "puppeteer-stream";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import util from "util";
import {
  autoStopCheckEverySeconds,
  autoStopMinMinutes,
  autoStopRequiredSilentWindows,
  autoStopSilenceWindowSeconds,
  baseUrl,
  defaultArgs,
  defaultGuestName,
  continueWithoutMediaLabels,
  defaultUserAgent,
  dismissButtonLabels,
  ffmpegPath,
  inCallIndicators,
  invalidMeetingIndicators,
  joinButtonLabels,
  overridePermissions,
  preJoinInitialDelayMs,
  preJoinLoadingIndicators,
  preJoinStepDelayMs,
  silenceNoiseThreshold,
  waitingRoomIndicators,
} from "./constants.js";
import {
  buildMeetingUrl,
  clickFirstMatchingButton,
  clickIfPresent,
  delay,
  fillGuestName,
  pageText,
  pageTextIncludes,
  waitForMeetingAdmission,
  waitForTextToDisappear,
} from "./utils.js";
import { BotManager, meetings } from "./botManager.js";
import { getTranscribe } from "./transcribe.js";

dotenv.config();

const execFilePromise = util.promisify(execFile);
const __dirname = path.resolve();
const recordingsDir = path.join(__dirname, "recordings");

const app = express();
app.use(express.json());

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("navigator.webdriver");
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteer.use(stealth);

let browser = null;

async function runFfmpeg(args) {
  return execFilePromise(ffmpegPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  });
}

async function detectSilenceInFile(filePath) {
  try {
    const { stderr } = await runFfmpeg([
      "-hide_banner",
      "-sseof",
      `-${autoStopSilenceWindowSeconds}`,
      "-i",
      filePath,
      "-af",
      `silencedetect=noise=${silenceNoiseThreshold}:d=${autoStopSilenceWindowSeconds}`,
      "-f",
      "null",
      "-",
    ]);

    const hasSilence = stderr.includes("silence_start");
    console.log(
      "SILENCE CHECK:",
      hasSilence ? "SILENCE DETECTED" : "NO SILENCE"
    );
    return hasSilence;
  } catch (error) {
    console.error("SILENCE CHECK ERROR:", error.message);
    return false;
  }
}

async function postProcessRecording(filePath) {
  const parsed = path.parse(filePath);
  const fixedPath = path.join(parsed.dir, `${parsed.name}-fixed.webm`);
  const compressedPath = path.join(parsed.dir, `${parsed.name}-small.webm`);

  await runFfmpeg([
    "-y",
    "-i",
    filePath,
    "-c",
    "copy",
    fixedPath,
  ]);

  await runFfmpeg([
    "-y",
    "-i",
    fixedPath,
    "-vf",
    "scale=640:-1",
    "-c:v",
    "libvpx",
    "-b:v",
    "250k",
    "-c:a",
    "libopus",
    "-b:a",
    "48k",
    compressedPath,
  ]);

  return { fixedPath, compressedPath };
}

function markMeetingStopped(meeting, reason) {
  meeting.isStopped = true;
  meeting.isStopping = false;
  meeting.stopReason = reason;
}

async function closeMeetingPage(meeting) {
  if (meeting.page && !meeting.page.isClosed()) {
    console.log("BEFORE page.close");
    await meeting.page.close();
    console.log("AFTER page.close");
  }
}

async function finalizeRecording(meeting) {
  if (!meeting?.filePath || !fs.existsSync(meeting.filePath)) {
    return null;
  }

  const processed = await postProcessRecording(meeting.filePath);
  meeting.processedFilePath = processed.fixedPath;
  meeting.compressedFilePath = processed.compressedPath;

  const transcriptSource = processed.compressedPath || processed.fixedPath;
  const transcript = await getTranscribe(transcriptSource);
  meeting.transcript = transcript;

  return {
    transcript,
    fixedPath: processed.fixedPath,
    compressedPath: processed.compressedPath,
  };
}

async function stopMeetingRecording(meeting, reason = "manual_stop") {
  if (!meeting) {
    return null;
  }

  if (meeting.isStopping) {
    return null;
  }

  meeting.isStopping = true;
  meeting.stopReason = reason;

  if (meeting.autoStopInterval) {
    clearInterval(meeting.autoStopInterval);
    meeting.autoStopInterval = null;
  }

  if (meeting.stream) {
    console.log("BEFORE stream.destroy");
    meeting.stream.destroy();
    meeting.stream = null;
    console.log("AFTER stream.destroy");
  }

  if (meeting.file) {
    console.log("BEFORE file.end");
    await new Promise((resolve) => meeting.file.end(resolve));
    meeting.file = null;
    console.log("AFTER file.end");
  }

  await closeMeetingPage(meeting);
  const output = await finalizeRecording(meeting);
  markMeetingStopped(meeting, reason);
  return output;
}

function scheduleAutoStop(meeting) {
  if (!meeting?.filePath) {
    return;
  }

  meeting.startedRecordingAt = new Date();
  meeting.silentWindows = 0;

  meeting.autoStopInterval = setInterval(async () => {
    if (meeting.isStopped || meeting.isStopping) {
      return;
    }

    const elapsedMs = Date.now() - new Date(meeting.startedRecordingAt).getTime();
    const minRecordingMs = autoStopMinMinutes * 60 * 1000;

    if (elapsedMs < minRecordingMs) {
      return;
    }

    const hasSilence = await detectSilenceInFile(meeting.filePath);
    meeting.silentWindows = hasSilence ? meeting.silentWindows + 1 : 0;

    console.log(
      "AUTO STOP WINDOW:",
      `${meeting.silentWindows}/${autoStopRequiredSilentWindows}`
    );

    if (meeting.silentWindows >= autoStopRequiredSilentWindows) {
      console.log("AUTO STOP TRIGGERED");
      await stopMeetingRecording(meeting, "silence_auto_stop");
    }
  }, autoStopCheckEverySeconds * 1000);
}

async function createBrowser({ url }) {
  browser = await launch(puppeteer, {
    headless: false,
    slowMo: 100,
    defaultViewport: null,
    executablePath:
      process.env.CHROME_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/usr/bin/google-chrome",
    args: defaultArgs,
    userDataDir: `${__dirname}/user`,
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, overridePermissions);

  return browser;
}

async function getPage(url) {
  console.log("START BROWSER");
  const existingPages = await browser.pages();
  const page = existingPages[0] || (await browser.newPage());
  console.log("PAGE CREATED");

  for (const extraPage of existingPages.slice(1)) {
    await extraPage.close().catch(() => {});
  }

  await page.setUserAgent(defaultUserAgent);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await delay(preJoinInitialDelayMs);

  console.log("PAGE TITLE:", await page.title());
  console.log("CURRENT URL:", page.url());

  return page;
}

async function assertMeetingPageIsJoinable(page, meetingUrl) {
  const content = (await pageText(page)).toLowerCase();

  for (const indicator of invalidMeetingIndicators) {
    if (content.includes(indicator.toLowerCase())) {
      throw new Error(`Invalid or expired Google Meet link: ${meetingUrl}`);
    }
  }
}

async function joinMeetAsGuest(page, meeting, recording, options = {}) {
  await page.screenshot({ path: "meet-debug.png", fullPage: true });
  console.log("SCREENSHOT SAVED");
  console.log("PAGE TEXT BEFORE ACTIONS:", (await pageText(page)).slice(0, 2000));

  await assertMeetingPageIsJoinable(page, meeting.meetingUrl || meeting.id);
  await waitForTextToDisappear(page, preJoinLoadingIndicators, 90000);
  console.log("PRE-JOIN LOADING DISAPPEARED");
  await page.screenshot({ path: "meet-after-loading.png", fullPage: true });
  console.log("SCREENSHOT AFTER LOADING SAVED");
  console.log("PAGE TEXT AFTER LOADING:", (await pageText(page)).slice(0, 2000));
  await delay(preJoinStepDelayMs);

  await clickIfPresent(page, dismissButtonLabels);
  await delay(preJoinStepDelayMs);
  await clickIfPresent(page, continueWithoutMediaLabels);
  await delay(preJoinStepDelayMs);

  await fillGuestName(page, meeting.displayName || defaultGuestName);
  console.log("GUEST NAME FILLED");
  await delay(preJoinStepDelayMs);

  await clickFirstMatchingButton(page, joinButtonLabels);
  console.log("JOIN REQUEST CLICKED");

  let waitingRoomDetected = null;
  for (const indicator of waitingRoomIndicators) {
    if (await pageTextIncludes(page, indicator)) {
      waitingRoomDetected = indicator;
      break;
    }
  }

  if (waitingRoomDetected) {
    console.log("WAITING ROOM DETECTED:", waitingRoomDetected);
  }

  await waitForMeetingAdmission(page, inCallIndicators);
  meeting.joinedAt = new Date();
  console.log("MEETING ADMISSION DETECTED");
  console.log("AFTER JOIN TEXT:", (await pageText(page)).slice(0, 1500));

  if (options.joinOnly) {
    console.log("JOIN-ONLY MODE: skipping recorder startup");
    return null;
  }

  return getRecorder(page, recording);
}

async function getRecorder(page, params = { audio: true, video: true }) {
  console.log("GET RECORDER START");
  let stream;

  try {
    stream = await getStream(page, {
      audio: params.audio,
      video: params.video,
    });
  } catch (e) {
    console.error("GET STREAM ERROR:", e);
    throw e;
  }

  console.log("RECORDER STARTED");

  fs.mkdirSync(recordingsDir, { recursive: true });

  const filePath = path.join(recordingsDir, `${Date.now()}.webm`);
  const file = fs.createWriteStream(filePath);
  stream.pipe(file);

  console.log(`Recording saved at: ${filePath}`);
  return { stream, file, filePath };
}

const main = async (id, recording, meetingUrl, displayName, options = {}) => {
  console.log("ENTER main");
  console.log("BROWSER EXISTS:", !!browser);

  if (!browser) {
    console.log("BEFORE createBrowser");
    await createBrowser({ url: baseUrl });
    console.log("AFTER createBrowser");
  }

  const resolvedMeetingUrl = buildMeetingUrl(meetingUrl || id, baseUrl);

  console.log("BEFORE getPage");
  const page = await getPage(resolvedMeetingUrl);
  console.log("AFTER getPage");

  const meeting = meetings.find((item) => item.id === id);
  if (meeting) {
    meeting.page = page;
    meeting.meetingUrl = resolvedMeetingUrl;
    meeting.displayName = displayName || meeting.displayName || defaultGuestName;
  }

  if (meeting?.isStopped) {
    await page.close();
    return;
  }

  const result = await joinMeetAsGuest(page, meeting || {}, recording, options);

  if (meeting && result) {
    meeting.stream = result.stream;
    meeting.filePath = result.filePath;
    meeting.file = result.file;
    scheduleAutoStop(meeting);
  }

  return result;
};

app.post("/join", async (req, res) => {
  console.log("JOIN BODY:", req.body);
  const { id, meetingUrl, displayName, isRecording, joinOnly } = req.body;
  const meetingId = id || meetingUrl;

  if (!meetingId) {
    return res.status(400).json({ error: "Invalid Params" });
  }

  try {
    const resolvedMeetingUrl = buildMeetingUrl(meetingUrl || meetingId, baseUrl);

    console.log("BEFORE BotManager JOIN");
    await BotManager({
      ...req.body,
      id: meetingId,
      meetingUrl: resolvedMeetingUrl,
      displayName: displayName || defaultGuestName,
    });
    console.log("AFTER BotManager JOIN");

    await main(meetingId, isRecording, resolvedMeetingUrl, displayName, {
      joinOnly: Boolean(joinOnly),
    });

    res.status(200).json({
      ok: true,
      id: meetingId,
      meetingUrl: resolvedMeetingUrl,
      displayName: displayName || defaultGuestName,
      joinOnly: Boolean(joinOnly),
      autoStop: {
        minMinutes: autoStopMinMinutes,
        checkEverySeconds: autoStopCheckEverySeconds,
        silenceWindowSeconds: autoStopSilenceWindowSeconds,
        requiredSilentWindows: autoStopRequiredSilentWindows,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed", details: e.message });
  }
});

app.get("/stop/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Id not Provided" });
  }

  try {
    const meeting = meetings.find((item) => item.id === id);
    const result = await stopMeetingRecording(meeting, "manual_stop");
    res.status(200).json({
      ok: true,
      id,
      result,
    });
  } catch (e) {
    console.error("STOP ERROR:", e);
    res.status(500).json({ error: "failed", details: e.message });
  }
});

app.get("/stop-all", async (_req, res) => {
  if (!browser) {
    return res.status(401).json({ error: "no instance available to stop" });
  }

  try {
    const stopped = [];

    for (const meeting of meetings) {
      const result = await stopMeetingRecording(meeting, "manual_stop_all");
      stopped.push({
        id: meeting.id,
        result,
      });
    }

    await browser.close();
    browser = null;

    res.status(200).json({
      ok: true,
      stopped,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed", details: e.message });
  }
});

app.listen(process.env.PORT || 8080, () =>
  console.log("Server Started on port 8080")
);
