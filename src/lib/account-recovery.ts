import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "./database";
import { CrmError } from "./errors";
const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const normalizeKey = (key: string) =>
  key.trim().replaceAll("-", "").replaceAll(" ", "").toLowerCase();
export function recoveryStatus(userId: string) {
  return {
    configured: !!db
      .prepare("SELECT user_id FROM crm_recovery_keys WHERE user_id=?")
      .get(userId),
  };
}
function limitAttempt(key: string, maximum: number) {
  const now = Date.now();
  const count = db
    .transaction(() => {
      const row = db
        .prepare(
          "SELECT attempts,window_start FROM crm_recovery_limits WHERE key=?",
        )
        .get(key) as { attempts: number; window_start: number } | undefined;
      const fresh = !row || now - row.window_start >= 15 * 60_000;
      const attempts = fresh ? 1 : row.attempts + 1;
      db.prepare(
        "INSERT INTO crm_recovery_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start",
      ).run(key, attempts, fresh ? now : row.window_start);
      db.prepare("DELETE FROM crm_recovery_limits WHERE window_start<?").run(
        now - 24 * 60 * 60_000,
      );
      return attempts;
    })
    .immediate();
  if (count > maximum)
    throw new CrmError("Too many attempts. Try again in 15 minutes.", 429);
}
export async function generateRecoveryKey(userId: string, password: string) {
  limitAttempt(`generate:${fingerprint(userId)}`, 5);
  const account = db
    .prepare(
      'SELECT password FROM "account" WHERE "userId"=? AND "providerId"=?',
    )
    .get(userId, "credential") as { password: string } | undefined;
  if (
    !account?.password ||
    !(await verifyPassword({ hash: account.password, password }))
  )
    throw new CrmError("Check your current password.", 400);
  const raw = randomBytes(32).toString("hex");
  db.transaction(() => {
    const current = db
      .prepare(
        'SELECT password FROM "account" WHERE "userId"=? AND "providerId"=?',
      )
      .get(userId, "credential") as { password: string } | undefined;
    if (current?.password !== account.password)
      throw new CrmError(
        "Your account changed. Sign in again before creating a recovery key.",
        409,
      );
    db.prepare(
      "INSERT INTO crm_recovery_keys VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET key_hash=excluded.key_hash,created_at=excluded.created_at",
    ).run(userId, fingerprint(raw), new Date().toISOString());
  }).immediate();
  return raw.match(/.{1,8}/g)!.join("-");
}
export async function resetWithRecoveryKey(
  email: string,
  key: string,
  newPassword: string,
) {
  if (newPassword.length < 12 || newPassword.length > 128)
    throw new CrmError("Use a password between 12 and 128 characters.");
  const normalizedEmail = email.trim().toLowerCase();
  limitAttempt("reset-global", 40);
  limitAttempt(`reset:${fingerprint(normalizedEmail)}`, 5);
  const keyHash = fingerprint(normalizeKey(key));
  const user = db
    .prepare('SELECT id FROM "user" WHERE lower(email)=?')
    .get(normalizedEmail) as { id: string } | undefined;
  const match =
    user &&
    db
      .prepare(
        "SELECT user_id FROM crm_recovery_keys WHERE user_id=? AND key_hash=?",
      )
      .get(user.id, keyHash);
  if (!user || !match)
    throw new CrmError(
      "The email and recovery key do not match, or this key has already been used.",
      400,
    );
  const hashed = await hashPassword(newPassword);
  db.transaction(() => {
    // Recheck under the write lock: a key is single-use even with simultaneous reset requests.
    const consumed = db
      .prepare("DELETE FROM crm_recovery_keys WHERE user_id=? AND key_hash=?")
      .run(user.id, keyHash);
    if (!consumed.changes)
      throw new CrmError("This recovery key has already been used.", 400);
    const updated = db
      .prepare(
        'UPDATE "account" SET password=?,"updatedAt"=? WHERE "userId"=? AND "providerId"=?',
      )
      .run(hashed, Date.now(), user.id, "credential");
    if (!updated.changes)
      throw new CrmError(
        "Password recovery is not available for this account.",
      );
    db.prepare('DELETE FROM "session" WHERE "userId"=?').run(user.id);
  }).immediate();
}
