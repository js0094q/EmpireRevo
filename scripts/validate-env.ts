import process from "node:process";

const REQUIRED_KEYS = ["ODDS_API_KEY"] as const;

const warnings: string[] = [];
const errors: string[] = [];

function ensureString(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function isValidHostName(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{0,253}$/i.test(value) && !value.startsWith(".") && !value.endsWith(".");
}

function validateOddsBase() {
  const raw = process.env.ODDS_API_BASE?.trim();
  if (!raw) return;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return;
    if (parsed.protocol !== "https:") {
      errors.push("ODDS_API_BASE must use https for non-localhost.");
      return;
    }
    if (parsed.username || parsed.password) {
      errors.push("ODDS_API_BASE must not include credentials.");
    }
    if (!isValidHostName(host)) {
      errors.push(`ODDS_API_BASE hostname is invalid: ${host}`);
    }
  } catch {
    errors.push("ODDS_API_BASE is not a valid URL.");
  }
}

function validateHostAllowlist() {
  const raw = process.env.ODDS_API_ALLOWED_HOSTS;
  if (!raw) return;
  const hosts = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const invalid = hosts.filter((host) => !isValidHostName(host));
  if (invalid.length) {
    errors.push(`ODDS_API_ALLOWED_HOSTS contains invalid entries: ${invalid.join(", ")}`);
  }
}

function validateSportKeys() {
  const raw = process.env.ODDS_ALLOWED_SPORT_KEYS;
  if (!raw) return;
  const keys = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const invalid = keys.filter((value) => value.length > 48 || !/^[a-z0-9_]+$/.test(value));
  if (invalid.length) {
    errors.push(`ODDS_ALLOWED_SPORT_KEYS has invalid values: ${invalid.join(", ")}`);
  }
}

for (const key of REQUIRED_KEYS) {
  if (!ensureString(process.env[key])) {
    errors.push(`Missing required env var: ${key}`);
  }
}

if (!ensureString(process.env.EMPIRE_INTERNAL_API_KEY)) {
  warnings.push("EMPIRE_INTERNAL_API_KEY is not set. Internal routes and raw odds mode will be restricted.");
}

validateOddsBase();
validateHostAllowlist();
validateSportKeys();

if (!ensureString(process.env.NEXT_PUBLIC_DEFAULT_LEAGUE)) {
  warnings.push("NEXT_PUBLIC_DEFAULT_LEAGUE is not set. The app will use nba by default.");
}

for (const warning of warnings) {
  console.log(`[warn] ${warning}`);
}

for (const error of errors) {
  console.error(`[error] ${error}`);
}

if (errors.length) {
  process.exitCode = 1;
}
