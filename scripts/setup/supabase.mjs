import { spawnSync } from "node:child_process";
import { ensureBackendVenv } from "../shared/backend-venv.mjs";
import { loadRootEnv } from "../shared/load-env.mjs";

loadRootEnv();

const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then rerun npm run supabase:check.",
  );
  process.exit(1);
}

const python = ensureBackendVenv();
const result = spawnSync(python, ["scripts/diagnostics/check-supabase.py"], {
  cwd: process.cwd(),
  env: { ...process.env, PYTHONPATH: "backend" },
  stdio: "inherit",
});
if ((result.status ?? 1) !== 0) {
  console.error("Supabase Database + Supabase Storage setup check failed.");
  process.exit(result.status ?? 1);
}
