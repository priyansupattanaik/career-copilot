import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('../../frontend/node_modules/@playwright/test');

const OUT_DIR = path.resolve('audit-screenshots');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const routesToCapture = [
  { name: 'landing_page', path: '/', isPublic: true },
  { name: 'sign_in', path: '/sign-in', isPublic: true },
  { name: 'sign_up', path: '/sign-up', isPublic: true },
  { name: 'dashboard', path: '/dashboard', isPublic: false },
  { name: 'resume_analysis_list', path: '/resume-analysis', isPublic: false },
  { name: 'resume_analysis_new', path: '/resume-analysis/new', isPublic: false },
  { name: 'resume_analysis_report', path: '/resume-analysis/report/demo-ats-1', isPublic: false },
  { name: 'mock_interview_home', path: '/mock-interview', isPublic: false },
  { name: 'mock_interview_setup', path: '/mock-interview/setup', isPublic: false },
  { name: 'mock_interview_report', path: '/mock-interview/report/demo-interview-1-report', isPublic: false },
  { name: 'mock_interview_preparation', path: '/mock-interview/preparation', isPublic: false },
  { name: 'learning_home', path: '/learning', isPublic: false },
  { name: 'learning_path_detail', path: '/learning/demo-path-1', isPublic: false },
  { name: 'jobs_home', path: '/jobs', isPublic: false },
  { name: 'jobs_detail', path: '/jobs/demo-job-1', isPublic: false },
  { name: 'community_home', path: '/community', isPublic: false },
  { name: 'community_profile', path: '/ada-lovelace', isPublic: false },
  { name: 'settings_profile', path: '/settings/profile', isPublic: false },
  { name: 'settings_account', path: '/settings/account', isPublic: false },
  { name: 'settings_preferences', path: '/settings/preferences', isPublic: false },
  { name: 'settings_privacy', path: '/settings/privacy', isPublic: false },
];

async function captureAll() {
  console.log('Starting screenshot capture in Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== Capturing Theme: ${theme.toUpperCase()} ===`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      colorScheme: theme,
    });

    await context.addCookies([
      {
        name: 'career_copilot_demo',
        value: '1',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);

    const page = await context.newPage();

    // Set initial theme in storage before navigating
    await page.addInitScript((th) => {
      window.localStorage.setItem('career-copilot-theme', th);
      document.documentElement.setAttribute('data-theme', th);
      document.documentElement.style.colorScheme = th;
    }, theme);

    for (const item of routesToCapture) {
      const url = `http://127.0.0.1:3000${item.path}`;
      const filename = `${item.name}_${theme}.png`;
      const outPath = path.join(OUT_DIR, filename);

      try {
        console.log(`Capturing ${filename} (${url})...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        
        // Ensure theme applied on DOM and all scroll reveals are triggered
        await page.evaluate((th) => {
          document.documentElement.setAttribute('data-theme', th);
          document.documentElement.style.colorScheme = th;
          window.localStorage.setItem('career-copilot-theme', th);
          document.querySelectorAll('.home-reveal').forEach((el) => {
            el.classList.add('home-revealed', 'home-reveal-instant');
          });
        }, theme);

        // Scroll down to trigger any dynamic/lazy layout or animations
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        await page.screenshot({
          path: outPath,
          fullPage: true,
        });

        // Also capture hero/top viewport if it's landing or dashboard
        if (item.name === 'landing_page') {
          await page.screenshot({
            path: path.join(OUT_DIR, `landing_hero_${theme}.png`),
            fullPage: false,
          });
        }
        if (item.name === 'dashboard') {
          await page.screenshot({
            path: path.join(OUT_DIR, `dashboard_viewport_${theme}.png`),
            fullPage: false,
          });
        }

        console.log(`Saved: ${filename}`);
      } catch (err) {
        console.error(`Error capturing ${filename}:`, err.message);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll captures complete! Files saved to:', OUT_DIR);
}

captureAll().catch((err) => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
