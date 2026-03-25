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
  const targetBox = await page.evaluate((buttonLabels) => {
    const normalized = buttonLabels.map((label) => label.toLowerCase());
    const candidates = [...document.querySelectorAll("button, [role='button'], div, span")];

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    const target = candidates.find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = (element.innerText || element.textContent || "")
        .trim()
        .toLowerCase();

      return normalized.some(
        (label) => text === label || text.includes(label)
      );
    });

    if (!target) {
      return null;
    }

    const clickable =
      target.closest("button") ||
      target.closest("[role='button']") ||
      target;

    const rect = clickable.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, labels);

  if (!targetBox) {
    throw new Error(`No button found for labels: ${labels.join(", ")}`);
  }

  await page.mouse.move(targetBox.x, targetBox.y);
  await page.mouse.click(targetBox.x, targetBox.y);
}

export async function clickIfPresent(page, labels) {
  const targetBox = await page.evaluate((buttonLabels) => {
    const normalized = buttonLabels.map((label) => label.toLowerCase());
    const candidates = [...document.querySelectorAll("button, [role='button'], div, span")];

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    const target = candidates.find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = (element.innerText || element.textContent || "")
        .trim()
        .toLowerCase();

      return normalized.some(
        (label) => text === label || text.includes(label)
      );
    });

    if (!target) {
      return null;
    }

    const clickable =
      target.closest("button") ||
      target.closest("[role='button']") ||
      target;

    const rect = clickable.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, labels);

  if (!targetBox) {
    return false;
  }

  await page.mouse.move(targetBox.x, targetBox.y);
  await page.mouse.click(targetBox.x, targetBox.y);
  return true;
}

export async function waitForAnyText(page, values, timeout = 30000) {
  await page.waitForFunction(
    (expectedValues) => {
      const bodyText = (document.body.innerText || "").toLowerCase();
      return expectedValues.some((value) =>
        bodyText.includes(value.toLowerCase())
      );
    },
    { timeout },
    values
  );
}

export async function getVisibleClickableElements(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    return [...document.querySelectorAll("button, [role='button'], div, span")]
      .filter((element) => isVisible(element))
      .map((element) => ({
        text: (element.innerText || element.textContent || "").trim(),
        className: element.className || "",
        role: element.getAttribute("role") || "",
        ariaLabel: element.getAttribute("aria-label") || "",
        tagName: element.tagName,
      }))
      .filter((item) => item.text)
      .slice(0, 80);
  });
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

export async function waitForTextToDisappear(page, values, timeout = 120000) {
  await page.waitForFunction(
    (expectedValues) => {
      const bodyText = (document.body.innerText || "").toLowerCase();
      return expectedValues.every(
        (value) => !bodyText.includes(value.toLowerCase())
      );
    },
    { timeout },
    values
  );
}
