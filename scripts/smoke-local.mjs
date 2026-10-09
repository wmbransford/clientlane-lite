import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const base = "http://localhost:4318";
if (
  await fetch(base + "/api/health")
    .then(() => true)
    .catch(() => false)
)
  throw new Error(
    "Stop the existing server before running the isolated launcher smoke test.",
  );
const dir = mkdtempSync(join(tmpdir(), "clientlane-launcher-"));
const child = spawn(process.execPath, ["scripts/local.mjs", "--no-open"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    DATABASE_PATH: join(dir, "qa.sqlite"),
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
let logs = "";
child.stdout.on("data", (b) => {
  logs = (logs + b).slice(-5000);
});
child.stderr.on("data", (b) => {
  logs = (logs + b).slice(-5000);
});
const ended = new Promise((resolve) => child.on("exit", resolve));
try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null)
      throw new Error("Launcher exited early. " + logs);
    if (
      await fetch(base + "/api/health")
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Launcher did not become ready. " + logs);
  assert.equal((await fetch(base + "/api/crm")).status, 401);
  const signup = await fetch(base + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({
      email: "launcher@example.test",
      name: "Launcher QA",
      password: randomBytes(24).toString("base64url"),
    }),
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  const save = await fetch(base + "/api/crm", {
    method: "POST",
    headers: { origin: base, cookie, "content-type": "application/json" },
    body: JSON.stringify({
      action: "create",
      kind: "contacts",
      data: { name: "Persistent local contact" },
    }),
  });
  assert.equal(save.status, 200);
  const state = await fetch(base + "/api/crm", { headers: { cookie } }).then(
    (r) => r.json(),
  );
  assert.equal(state.contacts[0].name, "Persistent local contact");
  console.log(
    `${process.platform}: launcher, local account, authenticated persistence and unsigned access rejection passed.`,
  );
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    ended,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
