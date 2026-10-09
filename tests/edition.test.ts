import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleState } from "../src/lib/sample";
import { createWorkspaceBackup } from "../src/lib/workspace-backup";
const dir = mkdtempSync(join(tmpdir(), "clientlane-lite-"));
process.env.DATABASE_PATH = join(dir, "test.sqlite");
test("Lite excludes paid workflows and refuses a Pro backup without losing data", async () => {
  const { db } = await import("../src/lib/database");
  const { workspaceFor, createRecord, restoreWorkspace, readState } =
    await import("../src/lib/crm");
  const { saveWorkspaceSettings } = await import("../src/lib/pro-service");
  try {
    const workspace = workspaceFor({ id: "lite-owner", name: "Lite" });
    assert.equal(readState(workspace).workspace.edition, "Lite");
    assert.throws(() => saveWorkspaceSettings(workspace.id, 1, {}), /Pro/);
    assert.throws(
      () =>
        createRecord(workspace.id, "deals", {
          name: "Paid pipeline",
          value: 100,
          pipelineId: "another",
        }),
      /Pro/,
    );
    const pro = sampleState("Pro");
    pro.settings.pipelines.push({ id: "another", name: "Other" });
    assert.throws(
      () => restoreWorkspace(workspace.id, createWorkspaceBackup(pro)),
      /Pro/,
    );
    assert.equal(readState(workspace).contacts.length, 0);
    createRecord(workspace.id, "deals", {
      name: "Lite deal",
      value: 100,
      pipelineId: "sales",
    });
    assert.equal(readState(workspace).deals.length, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
