import { z } from "zod";
import { auth } from "@/lib/auth";
import { CrmError } from "@/lib/errors";
import {
  generateRecoveryKey,
  recoveryStatus,
  resetWithRecoveryKey,
} from "@/lib/account-recovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("generate"),
      password: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("reset"),
      email: z.email().max(254),
      key: z.string().min(1).max(128),
      password: z.string().min(12).max(128),
    })
    .strict(),
]);
function fail(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof CrmError
          ? error.message
          : "Check your details and try again.",
    },
    {
      status: error instanceof CrmError ? error.status : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return fail(new CrmError("Please sign in.", 401));
  return Response.json(recoveryStatus(session.user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new CrmError("This request must come from this application.", 403);
    const reader = request.body?.getReader();
    let raw = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      if (reader)
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 4096) {
            await reader.cancel();
            throw new CrmError("Request too large.", 413);
          }
          raw += decoder.decode(value, { stream: true });
        }
      raw += decoder.decode();
    } finally {
      reader?.releaseLock();
    }
    const input = schema.parse(JSON.parse(raw));
    if (input.action === "generate") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) throw new CrmError("Please sign in.", 401);
      const key = await generateRecoveryKey(session.user.id, input.password);
      return Response.json(
        { key },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    await resetWithRecoveryKey(input.email, input.key, input.password);
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
