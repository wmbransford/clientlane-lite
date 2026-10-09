"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { RecordForm, singular, type Mutation } from "@/components/record-form";
import { WorkspaceRecovery } from "@/components/workspace-recovery";
import { RecoverySettings } from "@/components/account-recovery";
import { authClient } from "@/lib/auth-client";
import { mutateDemo } from "@/lib/demo-mutations";
import { sampleState } from "@/lib/sample";
import {
  money,
  displayDate,
  localDate,
  stages,
  schemas,
  type Kind,
  type State,
  type RecordItem,
  type Meta,
} from "@/lib/model";

// Original Lite composition. No Admin Kit or Scalar layouts are bundled here.
export function Brand() {
  return (
    <strong>
      Clientlane<span aria-hidden="true"> / </span>
      <span className="text-muted-foreground">Lite</span>
    </strong>
  );
}
const labels: Record<Kind, string> = {
  contacts: "Contacts",
  companies: "Companies",
  deals: "Pipeline",
  tasks: "Follow-ups",
  notes: "Notes",
};
const sections: Kind[] = ["contacts", "companies", "deals", "tasks", "notes"];
const body = ({ id, version, createdAt, updatedAt, ...data }: RecordItem) =>
  data;
type Form = {
  kind: Kind;
  item?: RecordItem;
  defaults?: Record<string, unknown>;
};
export function CrmApp({
  initial,
  demo = false,
  userName = "Alex",
}: {
  initial?: State;
  demo?: boolean;
  userName?: string;
}) {
  const [state, setState] = useState(() => initial || sampleState());
  const [section, setSection] = useState("contacts");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [archive, setArchive] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(state.workspace.name);
  const [importRows, setImportRows] = useState<unknown[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  async function mutate(command: Mutation) {
    if (busy) return false;
    setBusy(true);
    try {
      let next: State;
      if (demo) next = mutateDemo(state, command);
      else {
        const response = await fetch("/api/crm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save.");
        next = result;
      }
      setState(next);
      setName(next.workspace.name);
      toast.success("Saved");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to connect. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    try {
      if (demo) {
        setState(sampleState());
        toast.success("Demo reset");
        return;
      }
      const response = await fetch("/api/crm", { cache: "no-store" });
      if (!response.ok) throw new Error("Please sign in again.");
      const next = await response.json();
      setState(next);
      setName(next.workspace.name);
      toast.success("Refreshed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh.",
      );
    }
  }
  const company = (id: string) =>
    state.companies.find((c) => c.id === id)?.name || "—";
  const context = (item: RecordItem) =>
    "companyId" in item && item.companyId
      ? company(item.companyId)
      : "contactId" in item && item.contactId
        ? state.contacts.find((c) => c.id === item.contactId)?.name || "—"
        : "dealId" in item && item.dealId
          ? state.deals.find((d) => d.id === item.dealId)?.name || "—"
          : "—";
  const matches = (item: RecordItem) =>
    `${item.name} ${context(item)} ${"email" in item ? item.email : ""} ${"description" in item ? item.description : ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const openDeals = state.deals.filter(
    (d) => d.stage !== "Won" && d.stage !== "Lost",
  );
  const due = state.tasks.filter(
    (t) => !t.completed && t.dueDate && t.dueDate <= localDate(),
  );
  function exportContacts() {
    const csv = Papa.unparse(
      state.contacts.map(({ name, email, phone, role, status }) => ({
        name,
        email,
        phone,
        role,
        status,
      })),
      {
        escapeFormulae: true,
        columns: ["name", "email", "phone", "role", "status"],
      },
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientlane-contacts.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="lite-app">
      <header className="lite-header">
        <Link href="/">
          <Brand />
        </Link>
        <div className="lite-actions">
          <Badge variant="secondary">
            {demo ? "Demo · resets on reload" : "Stored on this computer"}
          </Badge>
          {demo ? (
            <Button asChild variant="outline">
              <Link href="/login?mode=signup">Create workspace</Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={async () => {
                const result = await authClient.signOut();
                if (result.error) toast.error("Unable to sign out.");
                else window.location.assign("/login");
              }}
            >
              Sign out
            </Button>
          )}
        </div>
      </header>
      <main className="lite-main">
        <div className="lite-title">
          <div>
            <p className="text-muted-foreground">YOUR LOCAL CRM</p>
            <h1>{state.workspace.name}</h1>
            <p>
              Welcome, {userName.split(" ")[0]}. Keep your next conversation in
              view.
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={refresh}>
            {demo ? "Reset demo" : "Refresh"}
          </Button>
        </div>
        <div className="lite-stats">
          <div>
            <span>People</span>
            <strong>{state.contacts.length}</strong>
          </div>
          <div>
            <span>Open opportunities</span>
            <strong>{openDeals.length}</strong>
          </div>
          <div>
            <span>Pipeline value</span>
            <strong>{money(openDeals.reduce((n, d) => n + d.value, 0))}</strong>
          </div>
          <div>
            <span>Follow-ups due</span>
            <strong>{due.length}</strong>
          </div>
        </div>
        <Tabs
          value={section}
          onValueChange={(value) => {
            setSection(value);
            setSearch("");
          }}
        >
          <div className="lite-nav">
            <TabsList>
              {sections.map((kind) => (
                <TabsTrigger key={kind} value={kind}>
                  {labels[kind]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          {sections.map((kind) => (
            <TabsContent key={kind} value={kind}>
              <Card>
                <CardHeader>
                  <div className="lite-toolbar">
                    <div>
                      <CardTitle>{labels[kind]}</CardTitle>
                      <CardDescription>
                        {state[kind].length} records in your workspace
                      </CardDescription>
                    </div>
                    <Button disabled={busy} onClick={() => setForm({ kind })}>
                      New {singular[kind]}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="lite-toolbar">
                    <Input
                      aria-label={`Search ${labels[kind].toLowerCase()}`}
                      placeholder="Search names, companies, and context…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {kind === "contacts" && (
                      <div className="lite-actions">
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => fileInput.current?.click()}
                        >
                          Import CSV
                        </Button>
                        <Button variant="outline" onClick={exportContacts}>
                          Export CSV
                        </Button>
                      </div>
                    )}
                  </div>
                  {kind === "deals" ? (
                    <div className="lite-board">
                      {stages.map((stage) => (
                        <section key={stage} className="lite-lane">
                          <h3>
                            {stage}
                            <Badge variant="secondary">
                              {
                                state.deals.filter((d) => d.stage === stage)
                                  .length
                              }
                            </Badge>
                          </h3>
                          {state.deals
                            .filter((d) => d.stage === stage && matches(d))
                            .map((deal) => (
                              <button
                                className="lite-deal"
                                key={deal.id}
                                onClick={() =>
                                  setForm({ kind: "deals", item: deal })
                                }
                              >
                                <strong>{deal.name}</strong>
                                <span>{company(deal.companyId)}</span>
                                <b>{money(deal.value)}</b>
                                <small>{displayDate(deal.closeDate)}</small>
                              </button>
                            ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setForm({ kind: "deals", defaults: { stage } })
                            }
                          >
                            Add deal
                          </Button>
                        </section>
                      ))}
                    </div>
                  ) : state[kind].filter(matches).length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {kind === "notes" ? "Note" : "Name"}
                          </TableHead>
                          <TableHead>Context</TableHead>
                          <TableHead>
                            {kind === "contacts"
                              ? "Email / relationship"
                              : kind === "tasks"
                                ? "Due / status"
                                : kind === "companies"
                                  ? "Website / industry"
                                  : "Added"}
                          </TableHead>
                          <TableHead>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state[kind].filter(matches).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <button
                                className="lite-record-name"
                                onClick={() => setForm({ kind, item })}
                              >
                                {item.name}
                              </button>
                            </TableCell>
                            <TableCell>{context(item)}</TableCell>
                            <TableCell>
                              {"email" in item ? (
                                <>
                                  {item.email || "No email"}
                                  <br />
                                  <Badge variant="outline">{item.status}</Badge>
                                </>
                              ) : "completed" in item ? (
                                <>
                                  {displayDate(item.dueDate)}
                                  <br />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      mutate({
                                        action: "update",
                                        kind: "tasks",
                                        id: item.id,
                                        version: item.version,
                                        data: {
                                          ...body(item),
                                          completed: !item.completed,
                                        },
                                      })
                                    }
                                  >
                                    {item.completed
                                      ? "Reopen"
                                      : "Mark complete"}
                                  </Button>
                                  {item.completed && (
                                    <Badge variant="secondary">Done</Badge>
                                  )}
                                </>
                              ) : "domain" in item ? (
                                <>
                                  {item.domain || "—"}
                                  <br />
                                  {item.industry}
                                </>
                              ) : (
                                displayDate(item.createdAt)
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit ${item.name.slice(0, 100)}`}
                                onClick={() => setForm({ kind, item })}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>
                          {search
                            ? "No matches"
                            : "Start with one relationship"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {search
                            ? "Try a different search."
                            : `Create your first ${singular[kind]} using the button above.`}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
          <TabsContent value="settings">
            <div className="lite-settings">
              <Card>
                <CardHeader>
                  <CardTitle>Your workspace</CardTitle>
                  <CardDescription>Local data. Your own pace.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await mutate({ action: "rename", name });
                    }}
                  >
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="workspace-name">
                          Workspace name
                        </FieldLabel>
                        <Input
                          id="workspace-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={100}
                          required
                        />
                      </Field>
                      <Button disabled={busy} type="submit">
                        Save name
                      </Button>
                    </FieldGroup>
                  </form>
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      demo ||
                      sections.some((k) => state[k].length > 0) ||
                      !!state.archived.length
                    }
                    onClick={() => mutate({ action: "seed" })}
                  >
                    Add fictional sample data
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Want multiple pipelines, custom fields, reports, saved
                    views, and follow-up rules? Pro adds those workflows. Lite
                    backups move into Pro.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/upgrade">Explore Pro · $199 once</Link>
                  </Button>
                </CardContent>
              </Card>
              <WorkspaceRecovery
                state={state}
                demo={demo}
                busy={busy}
                mutate={mutate}
              />
              {!demo && <RecoverySettings />}
            </div>
          </TabsContent>
        </Tabs>
        <footer className="lite-footer">
          Clientlane Lite · No cloud account required · Back up your workspace
          regularly.
        </footer>
      </main>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 1_000_000) {
            toast.error("Choose a CSV smaller than 1 MB.");
            return;
          }
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: "greedy",
            complete: (results) => {
              try {
                if (results.errors.length)
                  throw new Error("Check the CSV headings and row format.");
                if (!results.data.length || results.data.length > 1000)
                  throw new Error(
                    "Import between 1 and 1,000 contacts at a time.",
                  );
                setImportRows(
                  results.data.map((row) =>
                    schemas.contacts.parse({
                      name: row.name,
                      email: row.email || "",
                      phone: row.phone || "",
                      role: row.role || "",
                      status: row.status || "Lead",
                    }),
                  ),
                );
              } catch {
                toast.error(
                  "Check your CSV: name,email,phone,role,status. Status must be Lead, Customer, or Partner. Up to 1,000 rows.",
                );
              }
            },
            error: () => toast.error("Unable to read this file."),
          });
        }}
      />
      <Dialog
        open={!!importRows}
        onOpenChange={(open) => {
          if (!open && !busy) setImportRows(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts</DialogTitle>
            <DialogDescription>
              Add {importRows?.length} contacts? Import adds new records; it
              does not deduplicate existing contacts or link companies.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setImportRows(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (await mutate({ action: "import", rows: importRows || [] }))
                  setImportRows(null);
              }}
            >
              Import contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {form && (
        <RecordForm
          {...form}
          state={state}
          mutate={mutate}
          onClose={() => setForm(null)}
          onArchive={
            form.item
              ? () => {
                  setArchive(form);
                  setForm(null);
                }
              : undefined
          }
        />
      )}
      <Dialog
        open={!!archive}
        onOpenChange={(open) => {
          if (!open && !busy) setArchive(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this record?</DialogTitle>
            <DialogDescription>
              You can bring it back from Settings → Archive. Linked active
              records must be reassigned first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setArchive(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  archive?.item &&
                  (await mutate({
                    action: "archive",
                    kind: archive.kind,
                    id: archive.item.id,
                    version: archive.item.version,
                  }))
                )
                  setArchive(null);
              }}
            >
              Archive record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
