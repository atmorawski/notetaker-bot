import dotenv from "dotenv";
import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getStream, launch } from "puppeteer-stream";
import path from "path";
import fs from "fs";
import {
  defaultArgs,
  overridePermissions,
  defaultUserAgent,
  loginUrl,
  baseUrl,
} from "./constants.js";
import { isLoggedIn, loginUser } from "./utils.js";
import { BotManager, meetings } from "./botManager.js";
dotenv.config();

import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);
const detectSilenceInFile = async (filePath) => {
  try {
    const command = `ffmpeg -i "${filePath}" -af silencedetect=noise=-35dB:d=15 -f null -`;
    const { stderr } = await execPromise(command);

    const hasSilence =
      stderr.includes("silence_start") && stderr.includes("silence_end");

    console.log("SILENCE CHECK:", hasSilence ? "SILENCE DETECTED" : "NO SILENCE");

    return hasSilence;
  } catch (e) {
    console.error("SILENCE CHECK ERROR:", e.message);
    return false;
  }
};
const __dirname = path.resolve();
const app = express();
app.use(express.json());

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("navigator.webdriver");
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteer.use(stealth);

let browser = null;

async function createBrowser({ url }) {
  browser = await launch(puppeteer, {
    headless: false,
    slowMo: 100,
    defaultViewport: null,
 //   executablePath: process.env.CHROME_PATH,
    executablePath: "/usr/bin/google-chrome",
    args: defaultArgs,
    userDataDir: `${__dirname}/user`,
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, overridePermissions);

  return browser;
}

async function getPage(url) {
  console.log("START BROWSER");
  const page = await browser.newPage();
  console.log("PAGE CREATED");
  // LOAD COOKIES
//  const cookies = JSON.parse(fs.readFileSync("./cookies.json", "utf-8"));
//  await page.setCookie(...cookies);
//  console.log("COOKIES LOADED");


   await page.setUserAgent(defaultUserAgent);

await page.goto("https://accounts.google.com", {
  waitUntil: "domcontentloaded",
});

await new Promise(resolve => setTimeout(resolve, 3000));

await page.goto(url, {
  waitUntil: "domcontentloaded",
});

  console.log("PAGE TITLE:", await page.title());
console.log("CURRENT URL:", page.url());

const email = await page.evaluate(() => {
  const el = document.querySelector('[aria-label*="@"]');
  return el ? el.getAttribute('aria-label') : 'NO EMAIL FOUND';
});
console.log("LOGGED USER:", email);


  return page;
}

async function joinMeet(page, recording) {
  try {
    await page.screenshot({ path: "meet-debug.png", fullPage: true });
    console.log("SCREENSHOT SAVED");

    await page.locator('text=Dołącz').click();

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(
      "AFTER JOIN TEXT:",
      (await page.evaluate(() => document.body.innerText)).slice(0, 1500)
    );
    console.log("join button clicked");

    return await getRecorder(page, recording);
  } catch (err) {
    console.log("JOIN ERROR:", err?.message || err);
    console.log("join button not found - checking fallback...");

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log("PAGE TEXT AFTER FAIL:", pageText.slice(0, 1500));

    try {
      await page.locator('text=Return to home screen').click();
      console.log("Clicked Return to home screen");
    } catch (e) {
      console.log("Return button not found");
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.screenshot({ path: "meet-after-return.png", fullPage: true });
    console.log("AFTER RETURN SCREENSHOT SAVED");

    return await getRecorder(page, recording);
  }
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
  console.log("recorder Started");

  const filePath = path.join(__dirname, "recordings", `${Date.now()}.webm`);
  const file = fs.createWriteStream(filePath);

  stream.pipe(file);

  console.log(`Recording saved at: ${filePath}`);
  return { stream, file, filePath };

}

  const main = async (id, recording) => {
  console.log("ENTER main");
  console.log("BROWSER EXISTS:", !!browser);

  if (!browser) {
    console.log("BEFORE createBrowser");
    await createBrowser({ url: baseUrl });
    console.log("AFTER createBrowser");
  }

  console.log("BEFORE getPage");
  const page = await getPage(`${baseUrl}/${id}`);
  console.log("AFTER getPage");

  const meeting = meetings.find((m) => m.id === id);
  if (meeting) {
    meeting.page = page;
  }

  if (meeting && meeting.isStopped) {
    await page.close();
    return;
  }

  if (!(await isLoggedIn(page))) {
    await page.goto(loginUrl, { waitUntil: "networkidle2" });
    console.log("LOGIN URL:", page.url());
    console.log("LOGIN TITLE:", await page.title());
    console.log("LOGIN PAGE TEXT:", await page.evaluate(() => document.body.innerText));
    await loginUser(page);
    await page.goto(`${baseUrl}/${id}`, { waitUntil: "networkidle2" });
  }

  const result = await joinMeet(page, recording);

  if (meeting && result) {
    meeting.stream = result.stream;
    meeting.filePath = result.filePath;
    meeting.stream = result.stream;
    meeting.file = result.file;
  }
  return result;
};

app.post("/join", async (req, res) => {
  console.log("JOIN BODY:", req.body);
  const { id, isRecording } = req.body;
  if (!id) return res.status(400).json({ error: "Invalid Params" });

  try {
    console.log("BEFORE BotManager JOIN");
    await BotManager(req.body);
    console.log("AFTER BotManager JOIN");
    await main(id, isRecording);
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/stop/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Id not Provided" });

  try {
  console.log("BEFORE BotManager");
  await BotManager({ id }, true);
  console.log("AFTER BotManager");

  console.log("BEFORE meetings.find");
  const meeting = meetings.find(m => m.id === id);
  console.log("AFTER meetings.find", meeting ? "FOUND" : "NOT FOUND");

  if (meeting?.stream) {
    console.log("BEFORE stream.destroy");
    meeting.stream.destroy();
    console.log("AFTER stream.destroy");
  }

  if (meeting?.file) {
    console.log("BEFORE file.end");
    meeting.file.end();
    console.log("AFTER file.end");

    if (meeting?.page && !meeting.page.isClosed()) {
      console.log("BEFORE page.close");
      await meeting.page.close();
      console.log("AFTER page.close");
    }
  }

  console.log("BEFORE res.status");
  res.status(200).json("ok");
  console.log("AFTER res.status");
} catch (e) {
  console.error("STOP ERROR:", e);
  res.status(500).json({ error: "failed" });
}
});



app.get("/stop-all", async (req, res) => {
  if (!browser)
    return res.status(401).json({ error: "no instance available to stop" });

  try {
    for (let meeting of meetings) {
      await BotManager(meeting, true);
    }
    await browser.close();
    browser = null;
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.listen(process.env.PORT, () => console.log("Server Started on port 8080"));
