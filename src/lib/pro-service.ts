import { CrmError } from "@/lib/errors";
import type { Deal, Kind } from "@/lib/model";
import type { WorkspaceSettings } from "@/lib/workspace-settings";
export function requirePro(): never {
  throw new CrmError(
    "Open this workspace in Clientlane Pro to use these features.",
    403,
  );
}
export function saveWorkspaceSettings(
  _workspaceId: string,
  _version: number,
  _input: unknown,
) {
  requirePro();
}
export function validateProRecord(
  _workspaceId: string,
  kind: Kind,
  body: Record<string, unknown>,
) {
  if (
    (kind === "deals" && body.pipelineId && body.pipelineId !== "sales") ||
    (body.custom && Object.keys(body.custom as object).length)
  )
    requirePro();
}
export function runDealRules(
  _workspaceId: string,
  _deal: Deal,
  _previous: Deal | undefined,
  _createTask: (body: unknown) => unknown,
) {}
export function settingsHaveProFeatures(settings: WorkspaceSettings) {
  return (
    settings.pipelines.length > 1 ||
    settings.fields.length > 0 ||
    settings.views.length > 0 ||
    settings.rules.length > 0
  );
}
