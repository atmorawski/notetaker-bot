import dotenv from "dotenv";
dotenv.config();

export const baseUrl = "https://meet.google.com";
export const defaultArgs = [
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--password-store=basic",
];

export const overridePermissions = ["microphone", "camera", "notifications"];

export const defaultUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export const defaultGuestName =
  process.env.BOT_NAME || "Andrzej's Notetaker";

export const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
export const silenceNoiseThreshold =
  process.env.SILENCE_NOISE_THRESHOLD || "-35dB";
export const autoStopMinMinutes = Number(process.env.AUTO_STOP_MIN_MINUTES || 10);
export const autoStopCheckEverySeconds = Number(
  process.env.AUTO_STOP_CHECK_EVERY_SECONDS || 30
);
export const autoStopSilenceWindowSeconds = Number(
  process.env.AUTO_STOP_SILENCE_WINDOW_SECONDS || 15
);
export const autoStopRequiredSilentWindows = Number(
  process.env.AUTO_STOP_REQUIRED_SILENT_WINDOWS || 3
);
export const preJoinInitialDelayMs = Number(
  process.env.PRE_JOIN_INITIAL_DELAY_MS || 4000
);
export const preJoinStepDelayMs = Number(
  process.env.PRE_JOIN_STEP_DELAY_MS || 1500
);
export const chromeUserDataDir =
  process.env.CHROME_USER_DATA_DIR || null;

export const joinButtonLabels = [
  "Ask to join",
  "Ask to join now",
  "Request to join",
  "Join now",
  "Popros o dolaczenie",
  "Dolacz teraz",
  "Dolacz",
];

export const dismissButtonLabels = ["Got it", "Dismiss", "Rozumiem", "OK"];

export const continueWithoutMediaLabels = [
  "Continue without microphone and camera",
  "Continue without mic and camera",
  "Kontynuuj bez mikrofonu i kamery",
];

export const preJoinLoadingIndicators = [
  "Getting ready...",
  "You'll be able to join in just a moment",
  "Przygotowywanie...",
  "Za chwile bedziesz mogl dolaczyc",
];

export const waitingRoomIndicators = [
  "asking to join",
  "asked to join",
  "someone in the call must let you in",
  "you'll join when someone lets you in",
  "poproszono o dolaczenie",
  "czekasz na dolaczenie",
  "gdy ktos cie wpusci",
];

export const invalidMeetingIndicators = [
  "you can't join this video call",
  "the meeting code is invalid",
  "check your meeting code",
  "this meeting doesn't exist",
  "you may be using an old meeting link",
  "nie mozna dolaczyc do tego spotkania",
  "kod spotkania jest nieprawidlowy",
  "sprawdz kod spotkania",
  "to spotkanie nie istnieje",
  "mozesz uzywac starego linku do spotkania",
];

export const inCallIndicators = [
  "Leave call",
  "End call",
  "Meeting details",
  "Presentation",
  "Opusc rozmowe",
  "Zakoncz polaczenie",
  "Szczegoly spotkania",
  "Prezentuj",
];
