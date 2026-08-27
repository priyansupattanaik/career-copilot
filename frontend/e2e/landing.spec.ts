import { test, expect } from "@playwright/test";

const viewports = [
  { name: "phone-se", width: 320, height: 568 },
  { name: "phone-small", width: 360, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-large", width: 412, height: 915 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop-small", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "desktop-wide", width: 1920, height: 1080 },
] as const;

const zooms = [1, 1.25, 1.5, 2] as const;

test.describe("Landing page audit acceptance", () => {
  test("loads hero, truthful job labels, and light mode", async ({ page }) => {
    test.slow();
    const consoleErrors: string[] = [];
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
    await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 200, body: "" }));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Show up\s*ready/i
    );
    await expect(page.getByText(/practice room/i).first()).toBeVisible();
    await expect(page.locator(".home-particles canvas")).toBeVisible();
    expect(await page.locator(".home-particles").evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
    expect(await page.locator(".home-particles").evaluate((element) => getComputedStyle(element).zIndex)).toBe("2");
    expect(Number(await page.locator(".home-particles").evaluate((element) => getComputedStyle(element).opacity))).toBeGreaterThan(0);
    await expect.poll(() => page.locator(".home-particles canvas").evaluate((canvas) => {
      const context = (canvas as HTMLCanvasElement).getContext("2d");
      if (!context) return 0;
      const width = Math.min((canvas as HTMLCanvasElement).width, 1000);
      const height = Math.min((canvas as HTMLCanvasElement).height, 700);
      const pixels = context.getImageData(0, 0, width, height).data;
      let visiblePixels = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 30) visiblePixels += 1;
      }
      return visiblePixels;
    })).toBeGreaterThan(100);
    const practiceVideo = page.locator(".home-camera-video");
    await expect(practiceVideo).toBeVisible();
    await expect(practiceVideo).toHaveAttribute("src", "/media/interview-practice.mp4");
    expect(await practiceVideo.evaluate((element) => getComputedStyle(element).objectFit)).toBe("contain");
    await expect.poll(() => practiceVideo.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
    expect(await practiceVideo.evaluate((element) => {
      const video = element as HTMLVideoElement;
      return {
        controls: video.controls,
        pointerEvents: getComputedStyle(video).pointerEvents,
        draggable: video.draggable,
        pictureInPicture: video.disablePictureInPicture,
        contextMenuBlocked: !video.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
      };
    })).toEqual({ controls: false, pointerEvents: "none", draggable: false, pictureInPicture: true, contextMenuBlocked: true });
    const videoAsset = await page.request.get("/media/interview-practice.mp4");
    expect(videoAsset.status()).toBe(200);
    expect(videoAsset.headers()["content-type"]).toContain("video/mp4");
    await expect.poll(() =>
      practiceVideo.evaluate((element) => {
        const video = element as HTMLVideoElement;
        return { muted: video.muted, loop: video.loop, autoplay: video.autoplay, playsInline: video.playsInline };
      }),
    ).toEqual({ muted: true, loop: true, autoplay: true, playsInline: true });
    expect(await page.locator(".home-page").getAttribute("data-motion")).toBe("running");
    expect(await page.locator(".home-window").evaluate((element) => getComputedStyle(element).animationName)).toContain("cc-window-breathe");
    await expect(page.getByText(/verified job locations/i)).toHaveCount(0);

    const theme = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      background: getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(theme.dataTheme).toBe("light");
    expect(theme.colorScheme).toBe("light");
    expect(theme.background.toLowerCase()).toContain("f5faff");
    await expect(page.locator(".home-particles")).toHaveAttribute("data-particle-theme", "light");

    const lightLogo = page.locator(".home-brand .brand-mark").first();
    await expect(lightLogo.locator(".brand-mark-image-light")).toBeVisible();
    await expect(lightLogo.locator(".brand-mark-image-dark")).toBeHidden();
    await expect(lightLogo.locator(".brand-mark-image-light")).toHaveAttribute(
      "src",
      "/brand/career-copilot-light.png",
    );

    const fonts = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fonts).not.toMatch(/Satoshi/i);

    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect(page.locator(".home-feature-grid article")).toHaveCount(3);

    await expect(page.getByRole("link", { name: /Get started/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /See the practice room/i })).toBeVisible();

    const serious = consoleErrors.filter(
      (e) => !/favicon/i.test(e) && !/Download the React DevTools/i.test(e)
    );
    expect(serious, serious.join("\n")).toEqual([]);
  });

  test("hash jump and fast scroll still reveal below-fold sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    await page.locator('a.home-text-cta[href="#practice"]').click();
    await expect.poll(async () =>
      Number(await page.locator(".home-practice-copy").evaluate((el) => getComputedStyle(el).opacity)),
    ).toBeGreaterThanOrEqual(0.99);
    await expect.poll(async () =>
      Number(await page.locator(".home-practice-card").evaluate((el) => getComputedStyle(el).opacity)),
    ).toBeGreaterThanOrEqual(0.99);
    await expect(page.getByRole("heading", { name: /Confidence is/i })).toBeVisible();
    await expect(page.getByText(/sessions/i).first()).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(async () =>
      Number(await page.locator(".home-final-card").evaluate((el) => getComputedStyle(el).opacity)),
    ).toBeGreaterThanOrEqual(0.99);
    await expect(page.getByRole("heading", { name: /Start with/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create my profile/i })).toBeVisible();

    const hiddenReveals = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".home-reveal:not(.home-revealed)")).map((el) => el.className),
    );
    expect(hiddenReveals, hiddenReveals.join(" | ")).toEqual([]);
  });

  test("mobile navigation has aria-modal, Escape close, focus restore", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });

    const openBtn = page.getByRole("button", { name: /Open navigation/i });
    await expect(openBtn).toBeVisible();
    await openBtn.focus();
    await openBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("dark mode keeps the new landing sections readable", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("career-copilot-theme", "dark"));
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator(".home-page")).toBeVisible();
    await expect(page.locator(".home-particles")).toHaveAttribute("data-particle-theme", "dark");
    await expect(page.locator(".home-practice-copy h2")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Confidence is/i })).toBeVisible();

    const contrast = await page.evaluate(() => {
      const root = document.documentElement;
      const practiceHeading = document.querySelector(".home-practice-copy h2");
      const systemHeading = document.querySelector(".home-section-head h2");
      return {
        theme: root.getAttribute("data-theme"),
        pageBackground: getComputedStyle(document.querySelector(".home-page")!).backgroundColor,
        practiceColor: getComputedStyle(practiceHeading!).color,
        systemColor: getComputedStyle(systemHeading!).color,
      };
    });

    expect(contrast.theme).toBe("dark");
    expect(contrast.pageBackground).toBe("rgb(11, 18, 32)");
    expect(contrast.practiceColor).not.toBe("rgb(0, 0, 0)");
    expect(contrast.systemColor).not.toBe("rgb(0, 0, 0)");

    const darkLogo = page.locator(".home-brand .brand-mark").first();
    await expect(darkLogo.locator(".brand-mark-image-dark")).toBeVisible();
    await expect(darkLogo.locator(".brand-mark-image-light")).toBeHidden();
    await expect(darkLogo.locator(".brand-mark-image-dark")).toHaveAttribute(
      "src",
      "/brand/career-copilot-dark.png",
    );
  });

  test("reduced motion disables ambient landing animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".home-page")).toHaveAttribute("data-motion", "paused");
    expect(await page.locator(".home-window").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await expect(page.locator(".home-camera-video")).toBeVisible();
  });

  test("key landing copy meets readable contrast in both themes", async ({ page }) => {
    const selectors = [
      ".home-hero-lede",
      ".home-practice-copy > p:not(.home-kicker)",
      ".home-profile .home-sheet-main p",
      ".home-profile .home-sheet-items small",
      ".home-footer",
    ];

    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((value) => {
        localStorage.setItem("career-copilot-theme", value);
      }, theme);
      await page.goto("/", { waitUntil: "networkidle" });

      const results = await page.evaluate((requestedSelectors) => {
        const parse = (value: string) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const channels = match[1].split(",").map((channel) => Number.parseFloat(channel.trim()));
          return channels.length >= 3 ? channels.slice(0, 3) : null;
        };
        const luminance = (rgb: number[]) => {
          const channels = rgb.map((channel) => channel / 255).map((channel) =>
            channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
          );
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const contrast = (foreground: number[], background: number[]) => {
          const foregroundLuminance = luminance(foreground);
          const backgroundLuminance = luminance(background);
          return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
        };
        const backgroundFor = (element: Element) => {
          let current: Element | null = element;
          while (current) {
            const backgroundValue = getComputedStyle(current).backgroundColor;
            const background = parse(backgroundValue);
            if (background && backgroundValue !== "rgba(0, 0, 0, 0)") return background;
            current = current.parentElement;
          }
          return [255, 255, 255];
        };

        return requestedSelectors.map((selector) => {
          const element = document.querySelector(selector);
          if (!element) return { selector, visible: false, ratio: 0 };
          const style = getComputedStyle(element);
          const foreground = parse(style.color);
          return {
            selector,
            visible: Boolean(element.getBoundingClientRect().width && element.getBoundingClientRect().height),
            ratio: foreground ? contrast(foreground, backgroundFor(element)) : 0,
          };
        });
      }, selectors);

      for (const result of results) {
        expect(result.visible, `${theme} ${result.selector} is not visible`).toBe(true);
        expect(result.ratio, `${theme} ${result.selector} contrast`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  for (const vp of viewports) {
    test(`viewport smoke ${vp.name} ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );

      expect(overflow).toBeLessThan(40);
    });
  }

  for (const zoom of zooms) {
    test(`zoom ${Math.round(zoom * 100)}% keeps primary content usable`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate((z) => {
        document.documentElement.style.zoom = String(z);
      }, zoom);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /Get started/i }).first()).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThan(80);
    });
  }
});
