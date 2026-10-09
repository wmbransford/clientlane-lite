import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createWorkspaceBackup,
  parseWorkspaceBackup,
} from "../src/lib/workspace-backup";

const directory = mkdtempSync(join(tmpdir(), "clientlane-recovery-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");

test("archive and workspace recovery preserve relationships without replacing existing data", async (t) => {
  const { db } = await import("../src/lib/database");
  const {
    workspaceFor,
    createRecord,
    archiveRecord,
    restoreRecord,
    restoreWorkspace,
    readState,
    seedWorkspace,
  } = await import("../src/lib/crm");
  try {
    const source = workspaceFor({ id: "source-owner", name: "Source Owner" });
    const other = workspaceFor({ id: "other-owner", name: "Other Owner" });
    seedWorkspace(source.id);
    const sourceState = readState(source);
    const company = createRecord(source.id, "companies", {
      name: "Archived Company",
    });
    const contact = createRecord(source.id, "contacts", {
      name: "Archived Contact",
      companyId: company.id,
    });
    archiveRecord(source.id, "contacts", contact.id, 1);
    archiveRecord(source.id, "companies", company.id, 1);
    const backup = createWorkspaceBackup(readState(source));

    await t.test(
      "archive is account scoped, versioned and checks linked records",
      () => {
        assert.equal(readState(source).archived.length, 2);
        assert.equal(readState(other).archived.length, 0);
        assert.throws(
          () => restoreRecord(other.id, "companies", company.id, 2),
          /not found/,
        );
        assert.throws(
          () => restoreRecord(source.id, "companies", company.id, 1),
          /changed/,
        );
        assert.throws(
          () => restoreRecord(source.id, "contacts", contact.id, 2),
          /Restore “Archived Company” first/,
        );
        restoreRecord(source.id, "companies", company.id, 2);
        restoreRecord(source.id, "contacts", contact.id, 2);
        assert.equal(readState(source).archived.length, 0);
        assert.equal(
          readState(source).contacts.find((item) => item.id === contact.id)
            ?.companyId,
          company.id,
        );
        assert.equal(
          readState(source).contacts.find((item) => item.id === contact.id)
            ?.version,
          3,
        );
        assert.throws(
          () => restoreRecord(source.id, "contacts", contact.id, 2),
          /not found/,
        );
        assert.ok(
          readState(source).activity.some(
            (entry) => entry.message === "Archived Contact restored",
          ),
        );
      },
    );

    await t.test(
      "backup round trip includes archive, links, timestamps, amounts and recent activity",
      () => {
        const name = restoreWorkspace(
          other.id,
          JSON.parse(JSON.stringify(backup)),
        );
        const restored = readState({ ...other, name });
        assert.equal(name, source.name);
        assert.equal(restored.companies.length, sourceState.companies.length);
        assert.equal(restored.contacts.length, sourceState.contacts.length);
        assert.equal(restored.deals.length, sourceState.deals.length);
        assert.equal(restored.archived.length, 2);
        for (const original of sourceState.deals) {
          const copy = restored.deals.find(
            (item) => item.name === original.name,
          )!;
          assert.notEqual(copy.id, original.id);
          assert.equal(copy.createdAt, original.createdAt);
          assert.equal(copy.updatedAt, original.updatedAt);
          assert.equal(copy.value, original.value);
          assert.equal(copy.stage, original.stage);
          assert.equal(
            restored.contacts.find((item) => item.id === copy.contactId)?.name,
            sourceState.contacts.find((item) => item.id === original.contactId)
              ?.name,
          );
        }
        const archivedContact = restored.archived.find(
          (item) => item.kind === "contacts",
        )!;
        const archivedCompany = restored.archived.find(
          (item) => item.kind === "companies",
        )!;
        assert.equal(
          (archivedContact.record as { companyId: string }).companyId,
          archivedCompany.record.id,
        );
        assert.notEqual(archivedContact.record.id, contact.id);
        assert.equal(
          restored.notes[0].contactId,
          restored.contacts.find((item) => item.name === "Olivia Chen")!.id,
        );
        assert.ok(
          restored.activity.some((entry) =>
            entry.message.includes("Workspace restored"),
          ),
        );
        assert.ok(
          restored.activity.some(
            (entry) => entry.recordId === archivedContact.record.id,
          ),
        );
        assert.equal(createWorkspaceBackup(restored).data.archived.length, 2);
        // Restoring a second time cannot duplicate records or replace the destination.
        assert.throws(
          () => restoreWorkspace(other.id, backup),
          /empty workspace/,
        );
        assert.equal(readState(other).deals.length, sourceState.deals.length);
        assert.equal(
          readState(source).contacts.length,
          sourceState.contacts.length + 1,
        );
      },
    );

    await t.test(
      "malformed files, duplicate IDs, broken refs and wrong record kinds are rejected before writing",
      () => {
        const destination = workspaceFor({
          id: "bad-backup-owner",
          name: "Unchanged Name",
        });
        const duplicate = structuredClone(backup);
        duplicate.data.contacts[0].id = duplicate.data.companies[0].id;
        assert.throws(
          () => restoreWorkspace(destination.id, duplicate),
          /duplicate record/,
        );
        const missing = structuredClone(backup);
        missing.data.contacts[0].companyId = "missing";
        assert.throws(
          () => restoreWorkspace(destination.id, missing),
          /related record/,
        );
        const foreign = structuredClone(backup);
        foreign.data.contacts[0].companyId = other.id;
        assert.throws(
          () => restoreWorkspace(destination.id, foreign),
          /related record/,
        );
        const wrongKind = structuredClone(backup);
        wrongKind.data.contacts[0].companyId = wrongKind.data.deals[0].id;
        assert.throws(
          () => restoreWorkspace(destination.id, wrongKind),
          /related record/,
        );
        const archivedRef = structuredClone(backup);
        archivedRef.data.contacts[0].companyId = company.id;
        assert.throws(
          () => restoreWorkspace(destination.id, archivedRef),
          /archived record/,
        );
        assert.throws(
          () => restoreWorkspace(destination.id, { ...backup, version: 999 }),
          /version/,
        );
        assert.throws(
          () =>
            restoreWorkspace(destination.id, {
              ...backup,
              credentials: "unexpected",
            }),
          /Invalid workspace/,
        );
        assert.throws(
          () =>
            restoreWorkspace(destination.id, {
              ...backup,
              data: {
                ...backup.data,
                activity: [{ ...backup.data.activity[0], recordId: "missing" }],
              },
            }),
          /activity linked/,
        );
        assert.equal(readState(destination).contacts.length, 0);
        assert.equal(
          workspaceFor({ id: "bad-backup-owner", name: "Ignored" }).name,
          destination.name,
        );
      },
    );

    await t.test("late database failures roll back the entire restore", () => {
      const destination = workspaceFor({
        id: "rollback-owner",
        name: "Rollback",
      });
      db.exec(
        "CREATE TEMP TRIGGER fail_test_restore BEFORE INSERT ON crm_records WHEN NEW.kind='notes' BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END;",
      );
      try {
        assert.throws(
          () => restoreWorkspace(destination.id, backup),
          /simulated storage failure/,
        );
      } finally {
        db.exec("DROP TRIGGER fail_test_restore");
      }
      const state = readState(destination);
      assert.equal(
        state.companies.length +
          state.contacts.length +
          state.deals.length +
          state.tasks.length +
          state.notes.length +
          state.archived.length,
        0,
      );
      assert.equal(state.activity.length, 0);
      assert.equal(
        workspaceFor({ id: "rollback-owner", name: "Ignored" }).name,
        destination.name,
      );
    });

    await t.test(
      "archive-only destinations are protected and older plain exports remain readable",
      () => {
        const destination = workspaceFor({
          id: "archive-only-owner",
          name: "Archive",
        });
        const lone = createRecord(destination.id, "contacts", {
          name: "Keep this",
        });
        archiveRecord(destination.id, "contacts", lone.id, 1);
        assert.throws(
          () => restoreWorkspace(destination.id, backup),
          /empty workspace/,
        );
        assert.equal(
          readState(destination).archived[0].record.name,
          "Keep this",
        );
        const { archived, ...legacy } = sourceState;
        legacy.activity.push({
          id: "old-archive-event",
          recordId: "previously-archived",
          message: "Old archived record",
          createdAt: new Date().toISOString(),
        });
        const oldBackup = parseWorkspaceBackup(legacy);
        assert.ok(
          !oldBackup.data.activity.some(
            (event) => event.recordId === "previously-archived",
          ),
        );
        assert.equal(oldBackup.data.archived.length, 0);
        assert.equal(oldBackup.data.contacts.length, 5);
      },
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
