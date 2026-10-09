import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nBETTER_AUTH_URL=http://localhost:4318\nNEXT_TELEMETRY_DISABLED=1\n`,
    { mode: 0o600 },
  );
  console.log("Created local authentication configuration.");
}
const migration = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
  { stdio: "inherit" },
);
process.exit(migration.status ?? 1);
