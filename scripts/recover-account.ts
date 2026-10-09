import { loadEnvConfig } from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
loadEnvConfig(process.cwd());
async function main() {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const { db } = await import("../src/lib/database");
    const email = (await prompt.question("Local account email to recover: "))
      .trim()
      .toLowerCase();
    const user = db
      .prepare('SELECT id,email FROM "user" WHERE lower(email)=?')
      .get(email) as { id: string; email: string } | undefined;
    if (!user)
      throw new Error(
        "No account with that email exists on this installation.",
      );
    const confirmed = await prompt.question(
      `Type ${email} again to replace its recovery key: `,
    );
    if (confirmed.trim().toLowerCase() !== email)
      throw new Error("Cancelled. Nothing changed.");
    const raw = randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO crm_recovery_keys VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET key_hash=excluded.key_hash,created_at=excluded.created_at",
    ).run(
      user.id,
      createHash("sha256").update(raw).digest("hex"),
      new Date().toISOString(),
    );
    console.log(
      `\nSingle-use recovery key:\n${raw.match(/.{1,8}/g)!.join("-")}\n\nUse this key and your email at http://localhost:4318/recover. Keep the key private.`,
    );
    db.close();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Recovery failed.");
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}
void main();
