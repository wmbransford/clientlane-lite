import { auth } from "@/lib/auth";
import {
  archiveRecord,
  createRecord,
  CrmError,
  readState,
  restoreRecord,
  restoreWorkspace,
  seedWorkspace,
  updateRecord,
  workspaceFor,
} from "@/lib/crm";
import { kinds, schemas } from "@/lib/model";
import { z } from "zod";
import { db } from "@/lib/database";
import { readCommandBody, RequestTooLarge } from "@/lib/request-body";
import { saveWorkspaceSettings } from "@/lib/pro-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function workspace(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new CrmError("Please sign in.", 401);
  return workspaceFor(session.user);
}
function errorResponse(error: unknown) {
  if (error instanceof RequestTooLarge)
    return Response.json({ error: error.message }, { status: 413 });
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Check the form values." },
      { status: 400 },
    );
  if (error instanceof CrmError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "CRM operation failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "Unable to save your changes. Please try again." },
    { status: 500 },
  );
}
export async function GET(request: Request) {
  try {
    const w = await workspace(request);
    return Response.json(readState(w), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    kind: z.enum(kinds),
    data: z.unknown(),
  }),
  z.object({
    action: z.literal("update"),
    kind: z.enum(kinds),
    id: z.string().min(1),
    version: z.number().int().positive(),
    data: z.unknown(),
  }),
  z.object({
    action: z.literal("archive"),
    kind: z.enum(kinds),
    id: z.string().min(1),
    version: z.number().int().positive(),
  }),
  z.object({ action: z.literal("seed") }),
  z.object({
    action: z.literal("settings"),
    version: z.number().int().positive(),
    settings: z.unknown(),
  }),
  z.object({
    action: z.literal("restore"),
    kind: z.enum(kinds),
    id: z.string().min(1),
    version: z.number().int().positive(),
  }),
  z.object({ action: z.literal("restoreBackup"), backup: z.unknown() }),
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("import"),
    rows: z.array(schemas.contacts).min(1).max(1000),
  }),
]);
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new CrmError("This request must come from this application.", 403);
    const w = await workspace(request);
    const input = command.parse(await readCommandBody(request));
    if (input.action === "settings")
      saveWorkspaceSettings(w.id, input.version, input.settings);
    if (input.action === "create") createRecord(w.id, input.kind, input.data);
    if (input.action === "update")
      updateRecord(w.id, input.kind, input.id, input.version, input.data);
    if (input.action === "archive")
      archiveRecord(w.id, input.kind, input.id, input.version);
    if (input.action === "restore")
      restoreRecord(w.id, input.kind, input.id, input.version);
    if (input.action === "restoreBackup")
      w.name = restoreWorkspace(w.id, input.backup);
    if (input.action === "seed") seedWorkspace(w.id);
    if (input.action === "rename") {
      db.prepare("UPDATE crm_workspaces SET name=? WHERE id=?").run(
        input.name,
        w.id,
      );
      w.name = input.name;
    }
    if (input.action === "import")
      db.transaction(() => {
        for (const row of input.rows) createRecord(w.id, "contacts", row);
      })();
    return Response.json(readState(w), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
