import {
  schemas,
  kinds,
  type Deal,
  type RecordItem,
  type State,
  localDate,
} from "./model";
import {
  parseWorkspaceBackup,
  materializeBackup,
  workspaceRecordCount,
  archiveRestoreBlocker,
  createWorkspaceBackup,
} from "./workspace-backup";
import { settingsSchema } from "./workspace-settings";
import type { Mutation } from "../components/record-form";
export function mutateDemo(state: State, command: Mutation): State {
  let next = structuredClone(state);
  const kind = command.kind;
  let updated: RecordItem | undefined;
  let previous: RecordItem | undefined;
  const now = new Date().toISOString();
  if (command.action === "rename")
    next.workspace.name = command.name?.trim() || next.workspace.name;
  else if (command.action === "seed")
    throw new Error("The demo already has sample records.");
  else if (command.action === "restoreBackup") {
    if (workspaceRecordCount(next))
      throw new Error(
        "Restore needs an empty workspace, including its archive.",
      );
    next = materializeBackup(parseWorkspaceBackup(command.backup), () =>
      crypto.randomUUID(),
    );
    next.workspace.edition = state.workspace.edition;
  } else if (command.action === "settings") {
    if (state.workspace.edition !== "Pro")
      throw new Error("This feature is included in Pro.");
    if (command.version !== next.settingsVersion)
      throw new Error("Settings changed. Refresh and try again.");
    next.settings = settingsSchema.parse(command.settings);
    next.settingsVersion++;
  } else if (command.action === "import") {
    for (const input of command.rows || [])
      next.contacts.unshift({
        ...schemas.contacts.parse(input),
        id: crypto.randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
  } else if (kind && command.action === "create") {
    updated = {
      ...schemas[kind].parse(command.data),
      id: crypto.randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
    } as RecordItem;
    (next[kind] as RecordItem[]).unshift(updated);
  } else if (kind && command.action === "update") {
    previous = next[kind].find((record) => record.id === command.id);
    if (!previous) throw new Error("Record not found.");
    if (previous.version !== command.version)
      throw new Error("This record changed. Refresh and try again.");
    updated = {
      ...previous,
      ...schemas[kind].parse(command.data),
      version: previous.version + 1,
      updatedAt: now,
    } as RecordItem;
    next[kind] = (next[kind] as RecordItem[]).map((record) =>
      record.id === command.id ? updated! : record,
    ) as never;
  } else if (kind && command.action === "archive") {
    const record = next[kind].find((record) => record.id === command.id);
    if (!record || record.version !== command.version)
      throw new Error("This record changed. Refresh and try again.");
    const key =
      kind === "companies"
        ? "companyId"
        : kind === "contacts"
          ? "contactId"
          : kind === "deals"
            ? "dealId"
            : null;
    if (
      key &&
      kinds.some((k) =>
        next[k].some(
          (record) =>
            (record as unknown as Record<string, unknown>)[key] === command.id,
        ),
      )
    )
      throw new Error("Reassign linked records before archiving this record.");
    next.archived.unshift({
      kind,
      record: { ...record, version: record.version + 1, updatedAt: now },
      archivedAt: now,
    });
    next[kind] = (next[kind] as RecordItem[]).filter(
      (record) => record.id !== command.id,
    ) as never;
  } else if (kind && command.action === "restore") {
    const archived = next.archived.find(
      (entry) => entry.kind === kind && entry.record.id === command.id,
    );
    if (!archived || archived.record.version !== command.version)
      throw new Error("This archived record changed. Refresh and try again.");
    const blocker = archiveRestoreBlocker(next, archived.record);
    if (blocker) throw new Error(blocker);
    (next[kind] as RecordItem[]).unshift({
      ...archived.record,
      version: archived.record.version + 1,
      updatedAt: now,
    });
    next.archived = next.archived.filter(
      (entry) => entry.record.id !== command.id,
    );
  }
  next.activity.unshift({
    id: crypto.randomUUID(),
    recordId: command.id || updated?.id || "",
    message:
      command.action === "settings"
        ? "Workspace settings updated"
        : command.action === "rename"
          ? "Workspace renamed"
          : command.action === "restoreBackup"
            ? "Workspace restored"
            : `${kind || "Workspace"} ${command.action === "archive" ? "archived" : command.action === "restore" ? "restored" : "updated"}`,
    createdAt: now,
  });
  next.activity = next.activity.slice(0, 40);
  // The demo validates the same complete record graph used by portable backups.
  return createWorkspaceBackup(next).data;
}
