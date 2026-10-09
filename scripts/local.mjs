import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const nodeParts = process.versions.node.split(".").map(Number);
if (nodeParts[0] < 22 || (nodeParts[0] === 22 && nodeParts[1] < 13)) {
  console.error(
    "Clientlane needs Node.js 22.13 or newer. Install Node.js LTS, then open this launcher again.",
  );
  process.exit(1);
}
const openBrowser = () => {
  if (process.argv.includes("--no-open")) return;
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", "http://localhost:4318/workspace"]
      : ["http://localhost:4318/workspace"];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
};
const probe = () =>
  new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:4318/api/health", (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 4096) req.destroy();
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ occupied: true });
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve({ occupied: true });
    });
  });
const existing = process.argv.includes("--prepare-only") ? null : await probe();
if (existing?.application === "clientlane") {
  console.log("Clientlane is already running at http://localhost:4318.");
  openBrowser();
  process.exit(0);
}
if (existing) {
  console.error(
    "Port 4318 is in use by another application. Stop it before starting Clientlane.",
  );
  process.exit(1);
}
const pnpmAvailable =
  spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"], {
    encoding: "utf8",
  }).status === 0;
const runner = pnpmAvailable
  ? process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm"
  : process.platform === "win32"
    ? "npx.cmd"
    : "npx";
const prefix = pnpmAvailable ? [] : ["--yes", "pnpm@12.9.1"];
const run = (args) => {
  const r = spawnSync(runner, [...prefix, ...args], {
    stdio: "inherit",
    env: { ...process.env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" },
    shell: process.platform === "win32",
  });
  if (r.status !== 0)
    throw new Error(
      `Setup step failed: ${args.join(" ")}. Your data has been kept.`,
    );
};
try {
  if (!existsSync("node_modules/.modules.yaml")) {
    console.log(
      "Installing Clientlane dependencies. The first launch needs an internet connection.",
    );
    run(["install", "--frozen-lockfile"]);
  }
  run(["setup"]);
  const hash = createHash("sha256");
  function add(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) add(full);
      else {
        hash.update(full.slice(root.length));
        hash.update(readFileSync(full));
      }
    }
  }
  add(resolve("src"));
  for (const path of ["package.json", "pnpm-lock.yaml", "next.config.ts"])
    hash.update(readFileSync(path));
  const fingerprint = hash.digest("hex");
  if (
    !existsSync(".next/BUILD_ID") ||
    !existsSync(".next/clientlane-build") ||
    readFileSync(".next/clientlane-build", "utf8") !== fingerprint
  ) {
    console.log(
      "Preparing your local application. This can take a minute on first launch.",
    );
    run(["build"]);
    writeFileSync(".next/clientlane-build", fingerprint);
  }
  if (process.argv.includes("--prepare-only")) {
    console.log("Clientlane installation prepared.");
    process.exit(0);
  }
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "4318",
    ],
    { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
  );
  console.log(
    "\nClientlane runs only on this computer. Keep this window open; press Ctrl+C to stop.\n",
  );
  const ready = setInterval(async () => {
    const status = await probe();
    if (status?.application === "clientlane") {
      clearInterval(ready);
      openBrowser();
    }
  }, 800);
  server.on("exit", (code) => {
    clearInterval(ready);
    process.exitCode = code || 0;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      clearInterval(ready);
      server.kill(signal);
    });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
