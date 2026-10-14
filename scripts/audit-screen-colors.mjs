import fs from "node:fs";
import path from "node:path";

const files = [
  "frontend/src/styles/workbench.css",
  "frontend/src/shared/ui/workbench.tsx",
  "frontend/src/features/workspace/components/workspace-shell.tsx",
  "frontend/src/features/dashboard/components/dashboard.tsx",
  "frontend/src/features/dashboard/components/interview-progress-charts.tsx",
  "frontend/src/features/resume/components/resume-flow.tsx",
  "frontend/src/features/interview/components/interview-flow.tsx",
  "frontend/src/features/interview/components/interview-hub.tsx",
  "frontend/src/features/interview/components/interview-setup-view.tsx",
  "frontend/src/features/interview/components/interview-session.tsx",
  "frontend/src/features/interview/components/interview-report.tsx",
  "frontend/src/features/interview/components/interview-preparation.tsx",
  "frontend/src/features/learning/components/learning.tsx",
  "frontend/src/features/jobs/components/jobs.tsx",
  "frontend/src/features/jobs/components/job-card.tsx",
  "frontend/src/features/jobs/components/job-modal.tsx",
  "frontend/src/features/community/components/community-profiles.tsx",
];

const colorLiteralRegex = /#([0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`Missing file: ${file}`);
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  const matches = [];

  lines.forEach((line, idx) => {
    let m;
    while ((m = colorLiteralRegex.exec(line)) !== null) {
      matches.push({ line: idx + 1, match: m[0], text: line.trim() });
    }
  });

  if (matches.length > 0) {
    console.log(`\n=== ${file} (${matches.length} matches) ===`);
    for (const m of matches) {
      console.log(`  Line ${m.line}: ${m.match} => ${m.text.slice(0, 100)}`);
    }
  } else {
    console.log(`\n=== ${file}: CLEAN (0 literals) ===`);
  }
}
