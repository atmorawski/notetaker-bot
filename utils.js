import { userConfig } from "./constants.js";

export const delay = (time) => {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
};

export async function isLoggedIn(page) {
  const cookies = await page.cookies();
  const loggedIn = cookies.some(
    (c) => c.domain.includes("google.com") && c.name === "SID"
  );

  console.log(loggedIn ? "already logged in." : "not logged in");

  return loggedIn;
}

export const loginUser = async (page) => {
  console.log("START LOGIN FLOW");

  // 1. Detect account chooser
  const pageText = await page.evaluate(() => document.body.innerText);

  if (pageText.includes("Use another account")) {
    console.log("ACCOUNT CHOOSER DETECTED");

    const clicked = await page.evaluate(() => {
  const elements = [...document.querySelectorAll("div, span, button")];
  const target = elements.find(el => el.innerText?.trim() === "Use another account");
  if (target) {
    target.click();
    return true;
  }
  return false;
});

console.log("USE ANOTHER ACCOUNT CLICKED:", clicked);

if (clicked) {
  console.log("WAITING FOR EMAIL OR NAVIGATION AFTER ACCOUNT CHOOSER");

  await Promise.race([
    page.waitForSelector('input[type="email"]', { timeout: 30000 }),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
  ]);

  console.log("ACCOUNT CHOOSER STEP FINISHED");
}
  }

  // 2. EMAIL STEP
  console.log("WAITING FOR EMAIL INPUT");
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });

  await page.type('input[type="email"]', process.env.GOOGLE_EMAIL, {
    delay: 50,
  });

  console.log("EMAIL TYPED");

  const nextBtn = await page.$("#identifierNext button");
  if (nextBtn) {
    await nextBtn.click();
  }

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  // 3. PASSWORD STEP
  console.log("WAITING FOR PASSWORD INPUT");
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });

  await page.type('input[type="password"]', process.env.GOOGLE_PASSWORD, {
    delay: 50,
  });

  console.log("PASSWORD TYPED");

  await page.keyboard.press("Enter");

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  console.log("LOGIN FINISHED");
};
