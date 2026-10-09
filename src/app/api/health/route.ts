import { EDITION } from "@/lib/edition";
export function GET() {
  return Response.json(
    { application: "clientlane", edition: EDITION, version: "1.0.0-rc.1" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
