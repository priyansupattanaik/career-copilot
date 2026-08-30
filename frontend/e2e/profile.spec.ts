import { expect, test } from "@playwright/test";

test.describe("candidate profile responsive layout", () => {
  test("keeps the masthead and tabbed editor aligned inside the viewport", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([
      { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
    ]);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Candidate profile" })).toBeVisible();
      await expect(page.locator(".settings-nav")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Profile sections" })).toHaveCount(1);
      // The profile editor exposes seven real sections, including Links.
      await expect(page.getByRole("navigation", { name: "Profile sections" }).getByRole("link")).toHaveCount(7);

      await page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name: "Details" }).click();
      await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();
      await expect(page.locator("#profile-details .profile-fields")).toHaveCount(1);

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((nextTheme) => {
          document.documentElement.setAttribute("data-theme", nextTheme);
          document.documentElement.style.colorScheme = nextTheme;
        }, theme);

        const geometry = await page.locator(".profile-studio").evaluate((studio) => {
          const viewportWidth = document.documentElement.clientWidth;
          const studioRect = studio.getBoundingClientRect();
          const masthead = studio.querySelector<HTMLElement>(".profile-masthead");
          const photo = studio.querySelector<HTMLElement>(".profile-masthead-photo");
          const copy = studio.querySelector<HTMLElement>(".profile-masthead-copy");
          const meter = studio.querySelector<HTMLElement>(".profile-masthead-meter");
          const tabs = studio.querySelector<HTMLElement>(".profile-tabs");
          const editor = studio.querySelector<HTMLElement>(".profile-editor");
          const details = studio.querySelector<HTMLElement>("#profile-details");
          const heading = document.querySelector<HTMLElement>(".feature-page .page-heading");
          const mastheadRect = masthead?.getBoundingClientRect();
          const photoRect = photo?.getBoundingClientRect();
          const copyRect = copy?.getBoundingClientRect();
          const meterRect = meter?.getBoundingClientRect();
          const tabsRect = tabs?.getBoundingClientRect();
          const editorRect = editor?.getBoundingClientRect();
          const headingRect = heading?.getBoundingClientRect();
          const overflowing = [masthead, tabs, editor]
            .filter((el): el is HTMLElement => Boolean(el))
            .map((el) => ({
              name: el.className?.toString?.().slice(0, 80) || el.tagName,
              right: Math.round(el.getBoundingClientRect().right * 100) / 100,
            }))
            .filter(({ right }) => right > viewportWidth + 1);
          const fields = Array.from(details?.querySelectorAll<HTMLElement>(".profile-fields > *") ?? [])
            .slice(0, 2)
            .map((field) => Math.round(field.getBoundingClientRect().top * 100) / 100);
          const columnCount = (value: string) => (value.match(/minmax\([^)]+\)|[^\s]+/g) || []).filter((token) => token !== "none").length;
          const studioStyle = getComputedStyle(studio);
          const mastheadStyle = masthead ? getComputedStyle(masthead) : null;
          const fieldStyle = details?.querySelector<HTMLElement>(".profile-fields")
            ? getComputedStyle(details.querySelector<HTMLElement>(".profile-fields")!)
            : null;

          return {
            viewportWidth,
            pageWidth: document.documentElement.scrollWidth,
            studioRight: studioRect.right,
            studioLeft: Math.round(studioRect.left * 100) / 100,
            headingLeft: headingRect ? Math.round(headingRect.left * 100) / 100 : null,
            mastheadLeft: mastheadRect ? Math.round(mastheadRect.left * 100) / 100 : null,
            mastheadTop: mastheadRect ? Math.round(mastheadRect.top * 100) / 100 : null,
            mastheadBottom: mastheadRect ? Math.round(mastheadRect.bottom * 100) / 100 : null,
            photoLeft: photoRect ? Math.round(photoRect.left * 100) / 100 : null,
            photoRight: photoRect ? Math.round(photoRect.right * 100) / 100 : null,
            copyLeft: copyRect ? Math.round(copyRect.left * 100) / 100 : null,
            copyRight: copyRect ? Math.round(copyRect.right * 100) / 100 : null,
            copyBottom: copyRect ? Math.round(copyRect.bottom * 100) / 100 : null,
            meterLeft: meterRect ? Math.round(meterRect.left * 100) / 100 : null,
            meterTop: meterRect ? Math.round(meterRect.top * 100) / 100 : null,
            tabsTop: tabsRect ? Math.round(tabsRect.top * 100) / 100 : null,
            tabsBottom: tabsRect ? Math.round(tabsRect.bottom * 100) / 100 : null,
            editorLeft: editorRect ? Math.round(editorRect.left * 100) / 100 : null,
            editorTop: editorRect ? Math.round(editorRect.top * 100) / 100 : null,
            overflowing,
            fieldRowTops: fields,
            studioColumns: columnCount(studioStyle.gridTemplateColumns),
            mastheadColumns: columnCount(mastheadStyle?.gridTemplateColumns || ""),
            fieldColumns: columnCount(fieldStyle?.gridTemplateColumns || ""),
            detailsHidden: Boolean(details?.hidden),
            hasMasthead: Boolean(masthead),
            hasTabs: Boolean(tabs),
            hasEditor: Boolean(editor),
          };
        });

        expect(geometry.pageWidth, `page overflow at ${viewport.width}px (${theme})`).toBeLessThanOrEqual(
          geometry.viewportWidth,
        );
        expect(geometry.studioRight, `profile canvas overflow at ${viewport.width}px (${theme})`).toBeLessThanOrEqual(
          geometry.viewportWidth + 1,
        );
        expect(geometry.overflowing, `profile descendant overflow at ${viewport.width}px (${theme})`).toEqual([]);
        expect(
          Math.abs((geometry.headingLeft ?? 0) - geometry.studioLeft),
          `heading not aligned with profile body at ${viewport.width}px (${theme})`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs((geometry.mastheadLeft ?? 0) - geometry.studioLeft),
          `masthead not aligned with profile body at ${viewport.width}px (${theme})`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs((geometry.editorLeft ?? 0) - geometry.studioLeft),
          `editor not aligned with profile body at ${viewport.width}px (${theme})`,
        ).toBeLessThanOrEqual(2);
        expect(geometry.detailsHidden, `details pane should be open at ${viewport.width}px (${theme})`).toBe(false);
        expect(geometry.hasMasthead).toBe(true);
        expect(geometry.hasTabs).toBe(true);
        expect(geometry.hasEditor).toBe(true);
        expect(geometry.studioColumns, `studio should be a single column at ${viewport.width}px (${theme})`).toBe(1);
        expect(geometry.copyLeft ?? 0, `name should sit to the right of the photo at ${viewport.width}px (${theme})`).toBeGreaterThanOrEqual(
          (geometry.photoRight ?? 0) - 1,
        );
        expect(geometry.tabsTop ?? 0, `tabs should sit below the masthead at ${viewport.width}px (${theme})`).toBeGreaterThanOrEqual(
          (geometry.mastheadBottom ?? 0) - 1,
        );
        expect(geometry.editorTop ?? 0, `editor should sit below the tabs at ${viewport.width}px (${theme})`).toBeGreaterThanOrEqual(
          (geometry.tabsBottom ?? 0) - 1,
        );

        if (viewport.width >= 900) {
          expect(geometry.mastheadColumns, `masthead columns at ${viewport.width}px (${theme})`).toBe(3);
          expect(geometry.meterLeft ?? 0, `completion meter should sit to the right of the name at ${viewport.width}px (${theme})`).toBeGreaterThanOrEqual(
            (geometry.copyRight ?? 0) - 1,
          );
        } else {
          expect(geometry.meterTop ?? 0, `completion meter should sit below the name at ${viewport.width}px (${theme})`).toBeGreaterThanOrEqual(
            (geometry.copyBottom ?? 0) - 1,
          );
        }

        if (viewport.width > 720) {
          expect(geometry.fieldColumns, `details field columns at ${viewport.width}px (${theme})`).toBe(2);
          expect(geometry.fieldRowTops.length, `details field row at ${viewport.width}px (${theme})`).toBe(2);
          expect(
            Math.abs((geometry.fieldRowTops[0] ?? 0) - (geometry.fieldRowTops[1] ?? 0)),
            `details fields misaligned at ${viewport.width}px (${theme})`,
          ).toBeLessThanOrEqual(2);
        } else {
          expect(geometry.fieldColumns, `details should be one column at ${viewport.width}px (${theme})`).toBe(1);
        }
      }
    }
  });

  test("uploads, applies the agent draft automatically, and hides extraction diagnostics", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([
      { name: "career_copilot_demo", value: "1", url: new URL(page.url()).origin },
    ]);

    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name: "Resume" }).click();
    await page.getByLabel("Upload PDF or DOCX").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("synthetic resume fixture"),
    });

    await expect(page.getByText("Profile fill applied.", { exact: false })).toBeVisible();
    await expect(page.getByText("Technical extraction warning that must stay hidden.")).toHaveCount(0);
    await expect(page.getByText("Demo draft — resume saved to library for reuse.")).toHaveCount(0);
  });
});
