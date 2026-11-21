import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = path.join(frontendDir, ".vitest-tmp");
mkdirSync(tempDir, { recursive: true });
const vitestBin = path.join(frontendDir, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitestBin, "run", "--pool=threads", ...process.argv.slice(2)], {
  cwd: frontendDir,
  stdio: "inherit",
  env: { ...process.env, TMPDIR: tempDir, TEMP: tempDir, TMP: tempDir },
});
process.exit(result.status ?? 1);
