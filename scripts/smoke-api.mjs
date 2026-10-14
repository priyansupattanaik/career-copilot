/**
 * Smoke script that verifies all critical backend endpoint categories.
 * Can be run against a running backend server:
 *   node scripts/smoke-api.mjs [baseUrl]
 * Default: http://127.0.0.1:8000
 */
import { backendPort } from "./shared/ports.mjs";
import { loadRootEnv } from "./shared/load-env.mjs";

loadRootEnv();

const defaultPort = backendPort(process.env) || "8000";
const baseUrl = process.argv[2] || `http://127.0.0.1:${defaultPort}`;

const endpoints = [
  { path: "/health", expectedStatus: [200], name: "Unversioned /health" },
  { path: "/health/live", expectedStatus: [200], name: "Unversioned /health/live" },
  { path: "/api/health", expectedStatus: [200], name: "API /api/health" },
  { path: "/api/health/live", expectedStatus: [200], name: "API /api/health/live" },
  { path: "/api/v1/health/live", expectedStatus: [200], name: "API v1 health live" },
  { path: "/api/v1/health/ready", expectedStatus: [200, 503], name: "API v1 health ready" },
  { path: "/api/v1/public/username-availability?username=smoke_probe_test", expectedStatus: [200], name: "Username availability" },
  { path: "/api/v1/me/bootstrap", expectedStatus: [401], name: "Bootstrap (unauth)" },
  { path: "/api/v1/me/activity", expectedStatus: [401], name: "Activity (unauth)" },
  { path: "/api/v1/profile", expectedStatus: [401], name: "Profile (unauth)" },
  { path: "/api/v1/resumes", expectedStatus: [401], name: "Resumes (unauth)" },
  { path: "/api/v1/job-descriptions", expectedStatus: [401], name: "Job Descriptions (unauth)" },
  { path: "/api/v1/jobs", expectedStatus: [401], name: "Jobs (unauth)" },
  { path: "/api/v1/saved-jobs", expectedStatus: [401], name: "Saved Jobs (unauth)" },
  { path: "/api/v1/learning-paths", expectedStatus: [401], name: "Learning Paths (unauth)" },
  { path: "/api/v1/interviews", expectedStatus: [401], name: "Interviews (unauth)" },
  { path: "/api/v1/ats-analyses", expectedStatus: [401], name: "ATS Analyses (unauth)" },
  { path: "/api/v1/settings", expectedStatus: [401], name: "Settings (unauth)" },
  { path: "/api/v1/nonexistent-endpoint-smoke", expectedStatus: [404], name: "404 handler" },
];

async function runSmoke() {
  console.log(`[smoke] Testing API at: ${baseUrl}`);
  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    const url = `${baseUrl}${ep.path}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const statusOk = ep.expectedStatus.includes(res.status);
      if (statusOk) {
        console.log(`  ✓ [${res.status}] ${ep.name} (${ep.path})`);
        passed++;
      } else {
        console.error(`  ✗ [${res.status}] ${ep.name} (${ep.path}) - Expected: ${ep.expectedStatus.join(",")}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ [ERROR] ${ep.name} (${ep.path}): ${err.message}`);
      failed++;
    }
  }

  console.log(`[smoke] Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSmoke().catch((err) => {
  console.error("[smoke] Fatal error:", err);
  process.exit(1);
});
