import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const directory = mkdtempSync(join(tmpdir(), "clientlane-auth-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
test("recovery requires the current password, consumes the key and revokes sessions", async () => {
  const { db } = await import("../src/lib/database");
  const { auth } = await import("../src/lib/auth");
  const { getMigrations } = await import("better-auth/db/migration");
  const { generateRecoveryKey, resetWithRecoveryKey, recoveryStatus } =
    await import("../src/lib/account-recovery");
  try {
    await (await getMigrations(auth.options)).runMigrations();
    const oldPassword = randomBytes(24).toString("base64url");
    const newPassword = randomBytes(24).toString("base64url");
    const signup = await auth.api.signUpEmail({
      body: {
        email: "recovery@example.test",
        name: "Recovery QA",
        password: oldPassword,
      },
      asResponse: true,
    });
    assert.equal(signup.status, 200);
    const signedUp = await signup.json();
    const userId = signedUp.user.id;
    const cookie = signup.headers.get("set-cookie")!.split(";")[0];
    assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }) }));
    await assert.rejects(
      generateRecoveryKey(userId, "wrong-password"),
      /current password/,
    );
    const key = await generateRecoveryKey(userId, oldPassword);
    assert.equal(recoveryStatus(userId).configured, true);
    const stored = db
      .prepare("SELECT key_hash FROM crm_recovery_keys WHERE user_id=?")
      .get(userId) as { key_hash: string };
    assert.notEqual(stored.key_hash, key.replaceAll("-", ""));
    await assert.rejects(
      resetWithRecoveryKey("other@example.test", key, newPassword),
      /do not match/,
    );
    await resetWithRecoveryKey("RECOVERY@example.test", key, newPassword);
    assert.equal(recoveryStatus(userId).configured, false);
    assert.equal(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
      null,
    );
    await assert.rejects(
      resetWithRecoveryKey("recovery@example.test", key, oldPassword),
      /already been used/,
    );
    await assert.rejects(
      auth.api.signInEmail({
        body: { email: "recovery@example.test", password: oldPassword },
      }),
    );
    const signedIn = await auth.api.signInEmail({
      body: { email: "recovery@example.test", password: newPassword },
    });
    assert.equal(signedIn.user.id, userId);
    // A replacement invalidates the preceding unused key.
    const earlier = await generateRecoveryKey(userId, newPassword);
    const latest = await generateRecoveryKey(userId, newPassword);
    await assert.rejects(
      resetWithRecoveryKey("recovery@example.test", earlier, oldPassword),
      /do not match/,
    );
    await resetWithRecoveryKey("recovery@example.test", latest, oldPassword);
    assert.equal(recoveryStatus(userId).configured, false);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
