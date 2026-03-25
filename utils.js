export const delay = (time) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

export function buildMeetingUrl(idOrUrl, baseUrl) {
  if (!idOrUrl) {
    throw new Error("Meeting id or URL is required");
  }

  if (idOrUrl.startsWith("http://") || idOrUrl.startsWith("https://")) {
    return idOrUrl;
  }

  return `${baseUrl}/${idOrUrl}`;
}

export async function pageText(page) {
  return page.evaluate(() => document.body.innerText || "");
}

export async function pageTextIncludes(page, value) {
  const content = await pageText(page);
  return content.toLowerCase().includes(value.toLowerCase());
}

export async function fillGuestName(page, guestName) {
  await page.waitForFunction(
    () => {
      const inputs = [...document.querySelectorAll("input")];

      return inputs.some((input) => {
        const rect = input.getBoundingClientRect();
        const style = window.getComputedStyle(input);
        const label = [
          input.placeholder,
          input.getAttribute("aria-label"),
          input.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const looksLikeGuestNameField =
          input.type === "text" ||
          label.includes("your name") ||
          label.includes("name") ||
          label.includes("imi") ||
          label.includes("nazwa");

        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";

        return looksLikeGuestNameField && isVisible && !input.disabled;
      });
    },
    { timeout: 60000 }
  );

  const filled = await page.evaluate((name) => {
    const inputs = [...document.querySelectorAll("input")];

    const isVisibleTextInput = (input) => {
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !input.disabled
      );
    };

    const target =
      inputs.find((input) => {
        const label = [
          input.placeholder,
          input.getAttribute("aria-label"),
          input.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          isVisibleTextInput(input) &&
          (label.includes("your name") ||
            label.includes("name") ||
            label.includes("imi") ||
            label.includes("nazwa"))
        );
      }) ||
      inputs.find(
        (input) => input.type === "text" && isVisibleTextInput(input)
      );

    if (!target) {
      return false;
    }

    target.focus();
    target.value = "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.value = name;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, guestName);

  if (!filled) {
    throw new Error("Guest name input not found");
  }
}

export async function clickFirstMatchingButton(page, labels) {
  const clicked = await page.evaluate((buttonLabels) => {
    const normalized = buttonLabels.map((label) => label.toLowerCase());
    const candidates = [...document.querySelectorAll("button, div, span")];

    const target = candidates.find((element) => {
      const text = (element.innerText || element.textContent || "")
        .trim()
        .toLowerCase();

      return normalized.some(
        (label) => text === label || text.includes(label)
      );
    });

    if (!target) {
      return false;
    }

    (target.closest("button") || target).click();
    return true;
  }, labels);

  if (!clicked) {
    throw new Error(`No button found for labels: ${labels.join(", ")}`);
  }
}

export async function clickIfPresent(page, labels) {
  return page.evaluate((buttonLabels) => {
    const normalized = buttonLabels.map((label) => label.toLowerCase());
    const candidates = [...document.querySelectorAll("button, div, span")];

    const target = candidates.find((element) => {
      const text = (element.innerText || element.textContent || "")
        .trim()
        .toLowerCase();

      return normalized.some(
        (label) => text === label || text.includes(label)
      );
    });

    if (!target) {
      return false;
    }

    (target.closest("button") || target).click();
    return true;
  }, labels);
}

export async function waitForMeetingAdmission(page, indicators, timeout = 120000) {
  await page.waitForFunction(
    (expectedIndicators) => {
      const bodyText = (document.body.innerText || "").toLowerCase();
      return expectedIndicators.some((indicator) =>
        bodyText.includes(indicator.toLowerCase())
      );
    },
    { timeout },
    indicators
  );
}
