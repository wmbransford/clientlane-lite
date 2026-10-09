import { db } from "./database";
import { defaultSettings, settingsSchema } from "./workspace-settings";
export function readWorkspaceSettings(workspaceId: string) {
  const row = db
    .prepare("SELECT body,version FROM crm_settings WHERE workspace_id=?")
    .get(workspaceId) as { body: string; version: number } | undefined;
  return {
    settings: row
      ? settingsSchema.parse(JSON.parse(row.body))
      : defaultSettings(),
    settingsVersion: row?.version ?? 1,
  };
}
