import { z } from "zod";
import {
  defaultSettings,
  settingsSchema,
  validateCustomValues,
} from "./workspace-settings";
import {
  kinds,
  schemas,
  type Kind,
  type RecordItem,
  type State,
} from "./model";

export const BACKUP_MAX_BYTES = 20_000_000;
export const BACKUP_MAX_RECORDS = 10_000;
const id = z.string().min(1).max(100);
const timestamp = z.iso.datetime({ offset: true });
const meta = {
  id,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const records = {
  companies: schemas.companies.extend(meta),
  contacts: schemas.contacts.extend(meta),
  deals: schemas.deals.extend(meta),
  tasks: schemas.tasks.extend(meta),
  notes: schemas.notes.extend(meta),
};
const archiveSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("companies"),
      record: records.companies,
      archivedAt: timestamp,
    })
    .strict(),
  z
    .object({
      kind: z.literal("contacts"),
      record: records.contacts,
      archivedAt: timestamp,
    })
    .strict(),
  z
    .object({
      kind: z.literal("deals"),
      record: records.deals,
      archivedAt: timestamp,
    })
    .strict(),
  z
    .object({
      kind: z.literal("tasks"),
      record: records.tasks,
      archivedAt: timestamp,
    })
    .strict(),
  z
    .object({
      kind: z.literal("notes"),
      record: records.notes,
      archivedAt: timestamp,
    })
    .strict(),
]);
const stateSchema = z
  .object({
    workspace: z
      .object({
        name: z.string().trim().min(1).max(100),
        edition: z.enum(["Lite", "Pro"]),
      })
      .strict(),
    settings: settingsSchema.default(defaultSettings),
    settingsVersion: z.number().int().positive().default(1),
    companies: z.array(records.companies).max(BACKUP_MAX_RECORDS),
    contacts: z.array(records.contacts).max(BACKUP_MAX_RECORDS),
    deals: z.array(records.deals).max(BACKUP_MAX_RECORDS),
    tasks: z.array(records.tasks).max(BACKUP_MAX_RECORDS),
    notes: z.array(records.notes).max(BACKUP_MAX_RECORDS),
    archived: z.array(archiveSchema).max(BACKUP_MAX_RECORDS).default([]),
    activity: z
      .array(
        z
          .object({
            id,
            recordId: z.string().max(100),
            message: z.string().max(5500),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(40),
  })
  .strict();
const envelopeSchema = z
  .object({
    format: z.literal("clientlane-workspace"),
    version: z.union([z.literal(1), z.literal(2)]),
    exportedAt: timestamp,
    data: stateSchema,
  })
  .strict();
export type WorkspaceBackup = {
  format: "clientlane-workspace";
  version: 1 | 2;
  exportedAt: string;
  data: State;
};
export const referenceKinds = {
  companyId: "companies",
  contactId: "contacts",
  dealId: "deals",
} as const;
export function workspaceRecordCount(state: State) {
  return (
    kinds.reduce((sum, kind) => sum + state[kind].length, 0) +
    state.archived.length
  );
}
export function backupEntries(state: State) {
  return [
    ...kinds.flatMap((kind) =>
      state[kind].map((record) => ({
        kind,
        record: record as RecordItem,
        archivedAt: null as string | null,
      })),
    ),
    ...state.archived,
  ];
}
export function parseWorkspaceBackup(input: unknown): WorkspaceBackup {
  // Also accept the first prototype's plain workspace exports. They only contained active records.
  const legacy =
    input &&
    typeof input === "object" &&
    "workspace" in input &&
    !("format" in input);
  const parsed = envelopeSchema.safeParse(
    legacy
      ? {
          format: "clientlane-workspace",
          version: 1,
          exportedAt: new Date().toISOString(),
          data: input,
        }
      : input,
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Invalid workspace backup: ${issue.path.join(".") || "file"} — ${issue.message}`,
    );
  }
  const backup = parsed.data as WorkspaceBackup;
  const entries = backupEntries(backup.data);
  if (entries.length > BACKUP_MAX_RECORDS)
    throw new Error("Restore supports up to 10,000 records per file.");
  const byId = new Map<string, { kind: Kind; archivedAt: string | null }>();
  for (const entry of entries) {
    if (byId.has(entry.record.id))
      throw new Error("The backup contains duplicate record IDs.");
    byId.set(entry.record.id, entry);
  }
  // The original plain exports omitted archived records, although their events could remain.
  // Keep recoverable history for that legacy format; versioned backups must be self-contained.
  if (legacy)
    backup.data.activity = backup.data.activity.filter(
      (event) => !event.recordId || byId.has(event.recordId),
    );
  for (const entry of entries) {
    if (
      entry.kind === "deals" &&
      !backup.data.settings.pipelines.some(
        (pipeline) =>
          pipeline.id ===
          ((entry.record as { pipelineId?: string }).pipelineId || "sales"),
      )
    )
      throw new Error("A deal refers to a missing pipeline.");
    validateCustomValues(
      backup.data.settings,
      entry.kind,
      (entry.record as { custom?: Record<string, string | number | boolean> })
        .custom,
    );
    for (const [field, kind] of Object.entries(referenceKinds)) {
      const value = (entry.record as unknown as Record<string, unknown>)[field];
      if (!value) continue;
      const target = byId.get(value as string);
      if (!target || target.kind !== kind)
        throw new Error(
          `“${entry.record.name.slice(0, 100)}” has a missing or invalid related record.`,
        );
      if (!entry.archivedAt && target.archivedAt)
        throw new Error(
          `“${entry.record.name.slice(0, 100)}” links to an archived record. Restore that relationship in the source workspace first.`,
        );
    }
  }
  if (
    new Set(backup.data.activity.map((event) => event.id)).size !==
    backup.data.activity.length
  ) {
    throw new Error("The backup contains duplicate activity IDs.");
  }
  for (const event of backup.data.activity) {
    if (event.recordId && !byId.has(event.recordId))
      throw new Error(
        "The backup contains activity linked to a missing record.",
      );
  }
  return backup;
}
export function createWorkspaceBackup(state: State): WorkspaceBackup {
  const backup = parseWorkspaceBackup({
    format: "clientlane-workspace",
    version: 2,
    exportedAt: new Date().toISOString(),
    data: state,
  });
  if (
    new TextEncoder().encode(JSON.stringify(backup)).byteLength >
    BACKUP_MAX_BYTES
  ) {
    throw new Error(
      "This workspace exceeds the 20 MB portable backup limit. Use the full database backup instructions in the local guide.",
    );
  }
  return backup;
}
export function materializeBackup(
  backup: WorkspaceBackup,
  newId: () => string,
): State {
  const state = structuredClone(backup.data);
  const entries = backupEntries(state);
  state.settingsVersion = 1;
  const ids = new Map(entries.map(({ record }) => [record.id, newId()]));
  for (const { record } of entries) {
    record.id = ids.get(record.id)!;
    record.version = 1;
    for (const field of Object.keys(referenceKinds)) {
      const body = record as unknown as Record<string, unknown>;
      if (body[field]) body[field] = ids.get(body[field] as string)!;
    }
  }
  state.activity = state.activity.map((event) => ({
    ...event,
    id: newId(),
    recordId: event.recordId ? ids.get(event.recordId)! : "",
  }));
  return state;
}
export function archiveRestoreBlocker(state: State, record: RecordItem) {
  for (const [field, kind] of Object.entries(referenceKinds)) {
    const value = (record as unknown as Record<string, unknown>)[field];
    if (!value || state[kind].some((item) => item.id === value)) continue;
    const related = state.archived.find(
      (item) => item.kind === kind && item.record.id === value,
    );
    return related
      ? `Restore “${related.record.name}” first.`
      : "A related record is missing.";
  }
  return "";
}
