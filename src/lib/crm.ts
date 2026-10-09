import { randomUUID } from "node:crypto";
import { db } from "./database";
import {
  kinds,
  schemas,
  type Kind,
  type State,
  type RecordItem,
  type Activity,
} from "./model";
import { sampleState } from "./sample";
import { CrmError } from "./errors";
export { CrmError } from "./errors";
import { EDITION } from "./edition";
import { readWorkspaceSettings } from "./workspace-config";
import {
  validateProRecord,
  runDealRules,
  requirePro,
  settingsHaveProFeatures,
} from "./pro-service";
import type { Deal } from "./model";
import {
  backupEntries,
  materializeBackup,
  parseWorkspaceBackup,
  referenceKinds,
} from "./workspace-backup";
type Row = {
  id: string;
  body: string;
  kind: Kind;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
export function workspaceFor(user: { id: string; name: string }) {
  const existing = db
    .prepare("SELECT * FROM crm_workspaces WHERE owner_id=?")
    .get(user.id) as { id: string; name: string } | undefined;
  if (existing) return existing;
  db.prepare(
    "INSERT OR IGNORE INTO crm_workspaces (id,owner_id,name) VALUES (?,?,?)",
  ).run(randomUUID(), user.id, `${user.name.split(" ")[0]}’s workspace`);
  return db
    .prepare("SELECT * FROM crm_workspaces WHERE owner_id=?")
    .get(user.id) as { id: string; name: string };
}
function decode(row: Row): RecordItem {
  return {
    ...JSON.parse(row.body),
    id: row.id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function readState(workspace: { id: string; name: string }): State {
  return db.transaction(() => {
    const rows = db
      .prepare(
        "SELECT * FROM crm_records WHERE workspace_id=? ORDER BY created_at DESC,id",
      )
      .all(workspace.id) as Row[];
    const grouped = Object.fromEntries(
      kinds.map((k) => [
        k,
        rows.filter((r) => r.kind === k && !r.archived_at).map(decode),
      ]),
    );
    const activity = db
      .prepare(
        "SELECT id,record_id AS recordId,message,created_at AS createdAt FROM crm_activity WHERE workspace_id=? ORDER BY created_at DESC LIMIT 40",
      )
      .all(workspace.id) as Activity[];
    return {
      ...grouped,
      ...readWorkspaceSettings(workspace.id),
      archived: rows
        .filter((row) => row.archived_at)
        .map((row) => ({
          kind: row.kind,
          record: decode(row),
          archivedAt: row.archived_at!,
        }))
        .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)),
      activity,
      workspace: { name: workspace.name, edition: EDITION },
    } as State;
  })();
}
function event(workspaceId: string, id: string, message: string) {
  db.prepare("INSERT INTO crm_activity VALUES (?,?,?,?,?)").run(
    randomUUID(),
    workspaceId,
    id,
    message,
    new Date().toISOString(),
  );
}
function validateRefs(workspaceId: string, body: Record<string, unknown>) {
  for (const [field, kind] of [
    ["companyId", "companies"],
    ["contactId", "contacts"],
    ["dealId", "deals"],
  ]) {
    if (
      body[field] &&
      !db
        .prepare(
          "SELECT id FROM crm_records WHERE id=? AND workspace_id=? AND kind=? AND archived_at IS NULL",
        )
        .get(body[field], workspaceId, kind)
    )
      throw new CrmError("That related record is no longer available.", 400);
  }
}
export function createRecord(workspaceId: string, kind: Kind, input: unknown) {
  return db.transaction(() => {
    const body = schemas[kind].parse(input);
    validateRefs(workspaceId, body);
    validateProRecord(workspaceId, kind, body);
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO crm_records (id,workspace_id,kind,body,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    ).run(id, workspaceId, kind, JSON.stringify(body), now, now);
    event(
      workspaceId,
      id,
      kind === "notes" ? "Note added" : `${body.name} added`,
    );
    const created = { ...body, id, version: 1, createdAt: now, updatedAt: now };
    if (kind === "deals")
      runDealRules(workspaceId, created as Deal, undefined, (task) =>
        createRecord(workspaceId, "tasks", task),
      );
    return created;
  })();
}
export function updateRecord(
  workspaceId: string,
  kind: Kind,
  id: string,
  version: number,
  input: unknown,
) {
  return db.transaction(() => {
    const row = db
      .prepare(
        "SELECT * FROM crm_records WHERE id=? AND workspace_id=? AND kind=? AND archived_at IS NULL",
      )
      .get(id, workspaceId, kind) as Row | undefined;
    if (!row) throw new CrmError("Record not found.", 404);
    if (row.version !== version)
      throw new CrmError(
        "This record changed in another window. Refresh and try again.",
        409,
      );
    const body = schemas[kind].parse(input);
    validateRefs(workspaceId, body);
    validateProRecord(workspaceId, kind, body);
    const old = JSON.parse(row.body);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE crm_records SET body=?,version=version+1,updated_at=? WHERE id=? AND workspace_id=?",
    ).run(JSON.stringify(body), now, id, workspaceId);
    const message =
      kind === "deals" && "stage" in body && old.stage !== body.stage
        ? `${body.name} moved to ${body.stage}`
        : kind === "tasks" &&
            "completed" in body &&
            old.completed !== body.completed
          ? `${body.name} ${body.completed ? "completed" : "reopened"}`
          : `${kind === "notes" ? "Note" : body.name} updated`;
    event(workspaceId, id, message);
    if (kind === "deals")
      runDealRules(
        workspaceId,
        {
          ...body,
          id,
          version: version + 1,
          createdAt: row.created_at,
          updatedAt: now,
        } as Deal,
        {
          ...old,
          id,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        (task) => createRecord(workspaceId, "tasks", task),
      );
    return {
      ...body,
      id,
      version: version + 1,
      createdAt: row.created_at,
      updatedAt: now,
    };
  })();
}
export function archiveRecord(
  workspaceId: string,
  kind: Kind,
  id: string,
  version: number,
) {
  return db.transaction(() => {
    const row = db
      .prepare(
        "SELECT * FROM crm_records WHERE id=? AND workspace_id=? AND kind=? AND archived_at IS NULL",
      )
      .get(id, workspaceId, kind) as Row | undefined;
    if (!row) throw new CrmError("Record not found.", 404);
    if (row.version !== version)
      throw new CrmError("This record changed. Refresh and try again.", 409);
    // Keep relationships valid rather than silently detaching active customer history.
    const field =
      kind === "companies"
        ? "companyId"
        : kind === "contacts"
          ? "contactId"
          : kind === "deals"
            ? "dealId"
            : null;
    if (
      field &&
      db
        .prepare(
          `SELECT id FROM crm_records WHERE workspace_id=? AND archived_at IS NULL AND json_extract(body,'$.${field}')=? LIMIT 1`,
        )
        .get(workspaceId, id)
    )
      throw new CrmError(
        "Remove or reassign linked records before archiving this record.",
        409,
      );
    db.prepare(
      "UPDATE crm_records SET archived_at=?,updated_at=?,version=version+1 WHERE id=? AND workspace_id=?",
    ).run(new Date().toISOString(), new Date().toISOString(), id, workspaceId);
    event(
      workspaceId,
      id,
      `${kind === "notes" ? "Note" : JSON.parse(row.body).name} archived`,
    );
  })();
}
export function restoreRecord(
  workspaceId: string,
  kind: Kind,
  id: string,
  version: number,
) {
  return db
    .transaction(() => {
      const row = db
        .prepare(
          "SELECT * FROM crm_records WHERE id=? AND workspace_id=? AND kind=? AND archived_at IS NOT NULL",
        )
        .get(id, workspaceId, kind) as Row | undefined;
      if (!row)
        throw new CrmError(
          "Archived record not found. Refresh to see the latest archive.",
          404,
        );
      if (row.version !== version)
        throw new CrmError("This record changed. Refresh and try again.", 409);
      const body = schemas[kind].parse(JSON.parse(row.body));
      for (const [field, relatedKind] of Object.entries(referenceKinds)) {
        const value = (body as Record<string, unknown>)[field];
        if (!value) continue;
        const related = db
          .prepare(
            "SELECT * FROM crm_records WHERE id=? AND workspace_id=? AND kind=?",
          )
          .get(value, workspaceId, relatedKind) as Row | undefined;
        if (!related) throw new CrmError("A related record is missing.", 409);
        if (related.archived_at)
          throw new CrmError(
            `Restore “${JSON.parse(related.body).name}” first.`,
            409,
          );
      }
      db.prepare(
        "UPDATE crm_records SET archived_at=NULL,updated_at=?,version=version+1 WHERE id=? AND workspace_id=?",
      ).run(new Date().toISOString(), id, workspaceId);
      event(
        workspaceId,
        id,
        `${kind === "notes" ? "Note" : body.name} restored`,
      );
    })
    .immediate();
}
export function restoreWorkspace(workspaceId: string, input: unknown) {
  let backup;
  try {
    backup = parseWorkspaceBackup(input);
  } catch (error) {
    throw new CrmError(
      error instanceof Error ? error.message : "Invalid backup.",
    );
  }
  return db
    .transaction(() => {
      if (
        db
          .prepare("SELECT id FROM crm_records WHERE workspace_id=? LIMIT 1")
          .get(workspaceId)
      ) {
        throw new CrmError(
          "Restore needs an empty workspace, including its archive. Create a new local account to restore this backup without changing existing records.",
          409,
        );
      }
      if (
        !db.prepare("SELECT id FROM crm_workspaces WHERE id=?").get(workspaceId)
      )
        throw new CrmError("Workspace not found.", 404);
      if (settingsHaveProFeatures(backup.data.settings)) requirePro();
      const restored = materializeBackup(backup, randomUUID);
      db.prepare(
        "INSERT INTO crm_settings (workspace_id,body,version) VALUES (?,?,1) ON CONFLICT(workspace_id) DO UPDATE SET body=excluded.body,version=crm_settings.version+1",
      ).run(workspaceId, JSON.stringify(restored.settings));
      const insert = db.prepare(
        "INSERT INTO crm_records (id,workspace_id,kind,body,version,created_at,updated_at,archived_at) VALUES (?,?,?,?,?,?,?,?)",
      );
      for (const entry of backupEntries(restored)) {
        const { id, version, createdAt, updatedAt, ...body } = entry.record;
        insert.run(
          id,
          workspaceId,
          entry.kind,
          JSON.stringify(body),
          version,
          createdAt,
          updatedAt,
          entry.archivedAt,
        );
      }
      const insertActivity = db.prepare(
        "INSERT INTO crm_activity VALUES (?,?,?,?,?)",
      );
      for (const activity of restored.activity)
        insertActivity.run(
          activity.id,
          workspaceId,
          activity.recordId,
          activity.message,
          activity.createdAt,
        );
      db.prepare("UPDATE crm_workspaces SET name=? WHERE id=?").run(
        restored.workspace.name,
        workspaceId,
      );
      event(
        workspaceId,
        "",
        `Workspace restored from backup (${backupEntries(restored).length} records)`,
      );
      return restored.workspace.name;
    })
    .immediate();
}
export function seedWorkspace(workspaceId: string) {
  return db.transaction(() => {
    if (
      db
        .prepare("SELECT id FROM crm_records WHERE workspace_id=? LIMIT 1")
        .get(workspaceId)
    )
      throw new CrmError(
        "Sample data can only be added to an empty workspace.",
        409,
      );
    const sample = sampleState();
    const ids = new Map<string, string>();
    for (const kind of kinds)
      for (const record of sample[kind]) {
        const { id, version, createdAt, updatedAt, ...body } = record;
        const data = body as Record<string, unknown>;
        for (const field of ["companyId", "contactId", "dealId"])
          if (data[field]) data[field] = ids.get(data[field] as string) || "";
        const created = createRecord(workspaceId, kind, data);
        ids.set(id, created.id);
      }
  })();
}
