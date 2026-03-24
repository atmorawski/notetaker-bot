import dotenv from "dotenv";
dotenv.config();

export const baseUrl = "https://meet.google.com";
export const loginUrl = "https://accounts.google.com";
export const defaultArgs = [
//  "--disable-notifications",
//  "--mute-audio",
//  "--start-maximized",
  "--no-sandbox",
//  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--password-store=basic",
//  "--disable-blink-features=AutomationControlled", 
//  "--profile-directory=Default",
];
export const overridePermissions = ["microphone", "camera", "notifications"];

export const defaultUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
export const userConfig = {
  email: {
    selector: 'input[type="email"]',
    value: process.env.GOOGLE_EMAIL,
    action: async (page) => {
    await page.click("#identifierNext button");
    },
  },
  password: {
    selector: 'input[type="password"]',
    value: process.env.GOOGLE_PASSWORD,
    action: (page) => page.keyboard.press("Enter"),
  },
  typingDelay: 70,
};
