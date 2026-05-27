import { spawnSync } from "node:child_process";
import process from "node:process";

type Check = {
  label: string;
  command: string;
  args: string[];
  optional?: boolean;
};

const doSmoke = process.argv.includes("--smoke");
const quick = process.argv.includes("--quick");
let hasFailure = false;

const checks: Check[] = [
  { label: "Environment validation", command: "npm", args: ["run", "validate:env"] },
  { label: "Lint", command: "npm", args: ["run", "lint"] },
  { label: "Typecheck", command: "npm", args: ["run", "typecheck"] },
  { label: "Unit tests", command: "npm", args: ["run", "test"], optional: true },
  { label: "Production build", command: "npm", args: ["run", "build"] }
];

if (!quick) {
  checks.push({ label: "Visual regression", command: "npm", args: ["run", "test:visual"], optional: true });
}

if (doSmoke) {
  checks.push({
    label: "Launch smoke",
    command: "npm",
    args: ["run", "launch:smoke"]
  });
}

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    if (check.optional) {
      console.log(`[warn] Optional check failed: ${check.label}`);
      continue;
    }
    console.error(`[fail] ${check.label}`);
    hasFailure = true;
    break;
  }

  console.log(`[pass] ${check.label}`);
}

if (hasFailure) {
  process.exitCode = 1;
}
