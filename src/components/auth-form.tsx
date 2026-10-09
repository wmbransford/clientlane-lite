"use client";
import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, LockKeyhole, Database, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./crm-app";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field, FieldLabel, FieldGroup, FieldError } from "./ui/field";
export function AuthForm({ signup: initialSignup }: { signup: boolean }) {
  const [signup, setSignup] = useState(initialSignup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const input = {
        email: String(data.get("email")),
        password: String(data.get("password")),
      };
      const result = signup
        ? await authClient.signUp.email({
            ...input,
            name: String(data.get("name")),
          })
        : await authClient.signIn.email(input);
      if (result.error) {
        setError(result.error.message || "Unable to sign in.");
        return;
      }
      window.location.assign("/workspace");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="lite-auth">
      <div className="auth-panel">
        <Link className="back-link" href="/">
          Back to Clientlane
        </Link>
        <div className="auth-form">
          <div className="eyebrow">CLIENTLANE LITE</div>
          <h2>{signup ? "Create your local account." : "Welcome back."}</h2>
          <p>
            {signup
              ? "Create your account on this local installation."
              : "Sign in to your local workspace."}
          </p>
          <form onSubmit={submit}>
            <FieldGroup className="gap-5">
              {signup && (
                <Field>
                  <FieldLabel htmlFor="auth-name">Your name</FieldLabel>
                  <Input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    maxLength={100}
                    required
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="auth-email">Email</FieldLabel>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="auth-password">Password</FieldLabel>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  required
                />
                {signup && (
                  <span className="text-xs text-muted-foreground">
                    Use at least 12 characters.
                  </span>
                )}
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" size="lg" disabled={busy}>
                {busy && (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                )}
                {signup ? "Create workspace" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
          {!signup && (
            <Link className="demo-link" href="/recover">
              Forgot your password?
            </Link>
          )}
          <div className="auth-switch">
            {signup ? "Already have an account?" : "New here?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create a workspace"}
            </button>
          </div>
          <Link className="demo-link" href="/demo">
            Just looking? Explore the interactive demo
          </Link>
        </div>
      </div>
    </main>
  );
}
