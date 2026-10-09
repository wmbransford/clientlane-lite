"use client";
import { useRef, useState } from "react";
import {
  Archive,
  Download,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { kinds, displayDate, type State } from "@/lib/model";
import {
  archiveRestoreBlocker,
  BACKUP_MAX_BYTES,
  createWorkspaceBackup,
  parseWorkspaceBackup,
  workspaceRecordCount,
  type WorkspaceBackup,
} from "@/lib/workspace-backup";
import { singular, type Mutate } from "./record-form";
const labels = {
  companies: "Companies",
  contacts: "Contacts",
  deals: "Deals",
  tasks: "Follow-ups",
  notes: "Notes",
};

export function WorkspaceRecovery({
  state,
  demo,
  busy,
  mutate,
}: {
  state: State;
  demo: boolean;
  busy: boolean;
  mutate: Mutate;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [backup, setBackup] = useState<WorkspaceBackup | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileSelection = useRef(0);
  const empty = workspaceRecordCount(state) === 0;
  const archived = state.archived.filter(({ kind, record }) =>
    `${labels[kind]} ${record.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function exportBackup() {
    setDownloading(true);
    try {
      let latest = state;
      if (!demo) {
        const response = await fetch("/api/crm", { cache: "no-store" });
        if (!response.ok)
          throw new Error(
            "Unable to download. Refresh your workspace and sign in again if needed.",
          );
        latest = await response.json();
      }
      const snapshot = createWorkspaceBackup(latest);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `clientlane-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Workspace backup prepared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to export backup.");
    } finally {
      setDownloading(false);
    }
  }
  function changeRestoreOpen(open: boolean) {
    if (busy) return;
    fileSelection.current += 1;
    setBackup(null);
    setError("");
    setFilename("");
    setReading(false);
    setRestoreOpen(open);
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Backups & restore</CardTitle>
          <CardDescription>
            A portable copy of your workspace, ready when you need it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="recovery-summary">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Keep your relationships close.</strong>
              <p>
                Includes active and archived records, their links, and your 40
                most recent activity entries.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={busy || downloading}
            onClick={exportBackup}
          >
            {downloading ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            Download workspace backup
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => changeRestoreOpen(true)}
          >
            <Upload data-icon="inline-start" />
            Restore from backup
          </Button>
          <p className="text-sm text-muted-foreground">
            Your sign-in stays separate. Restore into an empty workspace on this
            computer or another Clientlane installation.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
          <CardDescription>
            Room to tidy up. A way to bring things back.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="archive-total">
            <Archive aria-hidden="true" />
            <strong>{state.archived.length}</strong>
            <span>
              archived {state.archived.length === 1 ? "record" : "records"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Archived records stay here until you restore them. Their original
            details and relationships are kept.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setArchiveOpen(true);
            }}
          >
            <FolderOpen data-icon="inline-start" />
            Open archive
          </Button>
        </CardContent>
      </Card>
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Workspace archive</DialogTitle>
            <DialogDescription>
              Restore records to your active workspace. If a linked company,
              contact, or deal is also archived, restore it first.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="archive-search">
              Find an archived record
            </FieldLabel>
            <Input
              id="archive-search"
              placeholder="Search by name or record type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <div className="archive-list" aria-live="polite">
            {archived.length ? (
              archived.map(({ kind, record, archivedAt }) => {
                const blocker = archiveRestoreBlocker(state, record);
                return (
                  <div className="archive-item" key={record.id}>
                    <div className="archive-item-copy">
                      <Badge variant="secondary">{singular[kind]}</Badge>
                      <p title={record.name}>{record.name}</p>
                      <small>Archived {displayDate(archivedAt)}</small>
                      {blocker && <p className="archive-blocker">{blocker}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !!blocker}
                      aria-label={`Restore ${record.name.slice(0, 100)}`}
                      onClick={() =>
                        mutate({
                          action: "restore",
                          kind,
                          id: record.id,
                          version: record.version,
                        })
                      }
                    >
                      <RotateCcw data-icon="inline-start" />
                      Restore
                    </Button>
                  </div>
                );
              })
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Archive />
                  </EmptyMedia>
                  <EmptyTitle>
                    {search ? "No matching records" : "Your archive is clear"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {search
                      ? "Try another name or record type."
                      : "Records you archive will appear here. You can bring them back whenever you need them."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={restoreOpen} onOpenChange={changeRestoreOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
          showCloseButton={!busy}
        >
          <DialogHeader>
            <DialogTitle>Restore your workspace</DialogTitle>
            <DialogDescription>
              Choose a Clientlane JSON backup to preview its contents. Your
              current sign-in will own the restored workspace.
            </DialogDescription>
          </DialogHeader>
          {!empty && (
            <Alert>
              <AlertDescription>
                This workspace already has records. To protect them, restore
                into a new local account with an empty workspace. You can still
                inspect a backup here.
              </AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="backup-file">Workspace backup</FieldLabel>
              <Input
                id="backup-file"
                type="file"
                accept=".json,application/json"
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={
                  error ? "backup-file-error" : "backup-file-hint"
                }
                onChange={async (e) => {
                  const selection = ++fileSelection.current;
                  const file = e.target.files?.[0];
                  setError("");
                  setBackup(null);
                  setFilename(file?.name || "");
                  setReading(false);
                  if (!file) return;
                  if (file.size > BACKUP_MAX_BYTES) {
                    setError("Choose a backup smaller than 20 MB.");
                    return;
                  }
                  setReading(true);
                  try {
                    const contents = await file.text();
                    const parsed = parseWorkspaceBackup(JSON.parse(contents));
                    if (selection === fileSelection.current) setBackup(parsed);
                  } catch (e) {
                    if (selection === fileSelection.current)
                      setError(
                        e instanceof SyntaxError
                          ? "This file is not valid JSON. Choose a Clientlane workspace backup."
                          : e instanceof Error
                            ? e.message
                            : "Unable to read this backup.",
                      );
                  } finally {
                    if (selection === fileSelection.current) setReading(false);
                  }
                }}
              />
              <FieldDescription id="backup-file-hint">
                JSON · up to 20 MB and 10,000 records. Earlier Clientlane
                workspace exports also work.
              </FieldDescription>
              {error && <FieldError id="backup-file-error">{error}</FieldError>}
            </Field>
          </FieldGroup>
          {reading && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your backup…
            </p>
          )}
          {backup && (
            <div className="backup-preview" aria-live="polite">
              <div className="backup-preview-title">
                <ShieldCheck aria-hidden="true" />
                <div className="backup-preview-copy">
                  <strong>{backup.data.workspace.name}</strong>
                  <p>{filename}</p>
                </div>
                <Badge variant="secondary">Ready</Badge>
              </div>
              <dl className="backup-counts">
                {kinds.map((kind) => (
                  <div key={kind}>
                    <dt>{labels[kind]}</dt>
                    <dd>{backup.data[kind].length}</dd>
                  </div>
                ))}
                <div>
                  <dt>Archived</dt>
                  <dd>{backup.data.archived.length}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                {workspaceRecordCount(backup.data)} records with their
                relationships. The workspace name will become “
                {backup.data.workspace.name}”.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => changeRestoreOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || reading || !backup || !empty}
              onClick={async () => {
                if (
                  backup &&
                  (await mutate({ action: "restoreBackup", backup }))
                ) {
                  setRestoreOpen(false);
                  setBackup(null);
                }
              }}
            >
              {busy ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              Restore workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
