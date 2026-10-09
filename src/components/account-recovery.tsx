"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "./ui/field";
import { Alert, AlertDescription } from "./ui/alert";
export function RecoverySettings() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/account/recovery")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (live) setConfigured(data.configured);
      })
      .catch(() => {
        if (live)
          setError("Unable to check recovery status. Refresh and try again.");
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account recovery</CardTitle>
        <CardDescription>Get back in without an email service.</CardDescription>
      </CardHeader>
      <CardContent>
        {key ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>
                Save this recovery key somewhere private. It is shown once,
                works once, and replaces any previous key.
              </AlertDescription>
            </Alert>
            <code className="recovery-key">{key}</code>
            <Button
              variant="outline"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      `Clientlane account recovery key\n\n${key}\n\nKeep this private. Use it with your account email at /recover on your local installation. It works once and does not replace a data backup.\n`,
                    ],
                    { type: "text/plain" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "clientlane-recovery-key.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download data-icon="inline-start" />
              Download recovery key
            </Button>
            <Button onClick={() => setKey("")}>I’ve saved my key</Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = e.currentTarget;
              try {
                const result = await fetch("/api/account/recovery", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "generate",
                    password: String(new FormData(form).get("password")),
                  }),
                });
                const data = await result.json();
                if (!result.ok) throw new Error(data.error);
                setKey(data.key);
                setConfigured(true);
                form.reset();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to create a key.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              {configured === null
                ? "Checking recovery setup…"
                : configured
                  ? "A recovery key is saved for this account. Generate a replacement if you no longer have it."
                  : "Create a recovery key now, while you still have access to your account."}
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="recovery-password">
                  Current password
                </FieldLabel>
                <Input
                  id="recovery-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
                <FieldDescription>
                  A new key replaces your previous key.
                </FieldDescription>
              </Field>
              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
            <Button variant="outline" disabled={busy || configured === null}>
              {busy ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <KeyRound data-icon="inline-start" />
              )}
              {configured ? "Replace recovery key" : "Create recovery key"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
export function RecoverAccount() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <main className="recovery-page">
      <Card>
        <CardHeader>
          <CardTitle>Recover your account</CardTitle>
          <CardDescription>
            Use the recovery key you saved from Settings. Your CRM records stay
            in place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col gap-5">
              <Alert>
                <AlertDescription>
                  Your password is updated and other sessions have been signed
                  out. After signing in, save a new recovery key.
                </AlertDescription>
              </Alert>
              <Button asChild>
                <Link href="/login">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const data = new FormData(e.currentTarget);
                if (data.get("password") !== data.get("confirm")) {
                  setError("Passwords do not match.");
                  setBusy(false);
                  return;
                }
                try {
                  const r = await fetch("/api/account/recovery", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "reset",
                      email: data.get("email"),
                      key: data.get("key"),
                      password: data.get("password"),
                    }),
                  });
                  const result = await r.json();
                  if (!r.ok) throw new Error(result.error);
                  setDone(true);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Unable to recover this account.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="recover-email">Account email</FieldLabel>
                  <Input
                    id="recover-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="recover-key">Recovery key</FieldLabel>
                  <Input
                    id="recover-key"
                    name="key"
                    autoComplete="off"
                    required
                    maxLength={128}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="recover-new">New password</FieldLabel>
                  <Input
                    id="recover-new"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                  <FieldDescription>
                    Use at least 12 characters.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="recover-confirm">
                    Confirm new password
                  </FieldLabel>
                  <Input
                    id="recover-confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
              <Button disabled={busy}>
                {busy && (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                )}
                Recover account
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground">
                Back to sign in
              </Link>
              <p className="text-sm text-muted-foreground">
                No saved key? The installation owner can use the local recovery
                command described in the setup guide.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
