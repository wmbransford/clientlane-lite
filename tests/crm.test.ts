import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "clientlane-test-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");

test("CRM behavior: tenant isolation, persistence, references, version conflicts and archive protection", async () => {
  const { db } = await import("../src/lib/database");
  const {
    workspaceFor,
    createRecord,
    updateRecord,
    archiveRecord,
    readState,
    seedWorkspace,
  } = await import("../src/lib/crm");
  try {
    const one = workspaceFor({ id: "owner-one", name: "Owner One" });
    const two = workspaceFor({ id: "owner-two", name: "Owner Two" });
    assert.notEqual(one.id, two.id);
    assert.equal(
      workspaceFor({ id: "owner-one", name: "Owner One" }).id,
      one.id,
    );
    const company = createRecord(one.id, "companies", { name: "Test Company" });
    const contact = createRecord(one.id, "contacts", {
      name: "First Contact",
      email: "first@example.com",
      companyId: company.id,
    });
    assert.equal(readState(one).contacts.length, 1);
    assert.equal(readState(two).contacts.length, 0);
    assert.throws(
      () =>
        createRecord(two.id, "contacts", {
          name: "Other",
          companyId: company.id,
        }),
      /related record/,
    );
    assert.throws(
      () =>
        updateRecord(two.id, "contacts", contact.id, 1, { name: "Attempt" }),
      /not found/,
    );
    const deal = createRecord(one.id, "deals", {
      name: "Test Deal",
      value: 123456,
      contactId: contact.id,
      companyId: company.id,
    });
    assert.throws(() =>
      createRecord(one.id, "deals", { name: "Negative", value: -1 }),
    );
    assert.throws(() =>
      createRecord(one.id, "deals", { name: "Fractional cent", value: 2.5 }),
    );
    const updated = updateRecord(one.id, "deals", deal.id, 1, {
      name: "Test Deal",
      value: 123456,
      contactId: contact.id,
      companyId: company.id,
      stage: "Won",
    });
    assert.equal(updated.version, 2);
    assert.equal(readState(one).deals[0].stage, "Won");
    assert.ok(
      readState(one).activity.some(
        (e) => e.message === "Test Deal moved to Won",
      ),
    );
    assert.throws(
      () =>
        updateRecord(one.id, "deals", deal.id, 1, {
          name: "Old edit",
          value: 1,
        }),
      /another window/,
    );
    assert.throws(
      () => archiveRecord(one.id, "contacts", contact.id, 1),
      /linked records/,
    );
    archiveRecord(one.id, "deals", deal.id, 2);
    assert.equal(readState(one).deals.length, 0);
    assert.equal(
      (
        db
          .prepare("SELECT count(*) AS count FROM crm_records WHERE id=?")
          .get(deal.id) as { count: number }
      ).count,
      1,
    );
    archiveRecord(one.id, "contacts", contact.id, 1);
    assert.equal(readState(one).contacts.length, 0);
    seedWorkspace(two.id);
    assert.equal(readState(two).contacts.length, 5);
    assert.equal(readState(two).deals.length, 7);
    assert.throws(() => seedWorkspace(two.id), /empty workspace/);
    // A second connection sees committed data: persistence is not a client-memory simulation.
    const Database = (await import("better-sqlite3")).default;
    const other = new Database(process.env.DATABASE_PATH!);
    assert.equal(
      (
        other
          .prepare(
            "SELECT count(*) AS count FROM crm_records WHERE workspace_id=? AND kind=?",
          )
          .get(two.id, "contacts") as { count: number }
      ).count,
      5,
    );
    other.close();
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
