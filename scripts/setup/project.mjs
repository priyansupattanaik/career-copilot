import { spawnSync } from "node:child_process";
import { loadRootEnv } from "../shared/load-env.mjs";

loadRootEnv();

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  return result.status ?? 1;
}

if (run(npm, ["--prefix", "frontend", "ci"]) !== 0) process.exit(1);
if (run("node", ["scripts/setup/backend.mjs"]) !== 0) process.exit(1);
if (run("node", ["scripts/setup/supabase.mjs"]) !== 0) {
  console.warn(
    "[setup] Supabase connectivity check failed. Frontend and backend installs completed. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then rerun npm run supabase:check.",
  );
}
