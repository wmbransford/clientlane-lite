import { BACKUP_MAX_BYTES } from "./workspace-backup";
export class RequestTooLarge extends Error {}
// Bound allocation while reading, including chunked requests without Content-Length.
export async function readCommandBody(request: Request) {
  const maximum = BACKUP_MAX_BYTES + 1024;
  if (Number(request.headers.get("content-length")) > maximum)
    throw new RequestTooLarge("Workspace backups must be smaller than 20 MB.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader)
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximum) {
          await reader.cancel();
          throw new RequestTooLarge(
            "Workspace backups must be smaller than 20 MB.",
          );
        }
        chunks.push(value);
      }
  } finally {
    reader?.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const input = JSON.parse(new TextDecoder().decode(bytes));
  if (size > 1_000_000 && input?.action !== "restoreBackup")
    throw new RequestTooLarge(
      "Import up to 1,000 contacts in a file smaller than 1 MB.",
    );
  if (
    input?.action === "restoreBackup" &&
    new TextEncoder().encode(JSON.stringify(input.backup)).byteLength >
      BACKUP_MAX_BYTES
  )
    throw new RequestTooLarge("Workspace backups must be smaller than 20 MB.");
  return input;
}
