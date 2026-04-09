import fs from "node:fs";
import path from "node:path";

function readText(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

const checks = [
  {
    file: "src/phaser/createPhaserGame.ts",
    patterns: [
      /scene\/load/,
      /scene\/unload/,
      /scene-load-success:/,
      /scene-load-failed:/,
      /scene-run-retry:/,
    ],
  },
  {
    file: "src/store/gameStore.ts",
    patterns: [
      /markShrimpCompleted/,
      /markCatanCompleted/,
      /festivalUnlocked:/,
      /fishingChestEligible:/,
      /reservoirChestOpened:/,
    ],
  },
  {
    file: "src/bus/types.ts",
    patterns: [
      /"scene\/load"/,
      /"scene\/unload"/,
      /"map\/festival-gift-opened"/,
      /"map\/reservoir-chest-opened"/,
      /"shrimp\/completed"/,
    ],
  },
  {
    file: "docs/implementation-status.md",
    patterns: [/主流程已完成/, /钓鱼模块：已完成完整玩法闭环/, /卡坦模块：已完成主玩法闭环/],
  },
];

const failures = [];

for (const check of checks) {
  const content = readText(check.file);
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      failures.push(`${check.file} missing pattern: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Smoke contract check failed:");
  failures.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

console.log("Smoke contract check passed.");
