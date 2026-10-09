"use client";
import { useState } from "react";
import { ProFields } from "./pro-fields";
import { z } from "zod";
import { Archive, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  schemas,
  stages,
  type Kind,
  type RecordItem,
  type State,
} from "@/lib/model";
export type Mutation = {
  action: string;
  kind?: Kind;
  id?: string;
  version?: number;
  data?: unknown;
  rows?: unknown[];
  name?: string;
  backup?: unknown;
  settings?: unknown;
};
export type Mutate = (command: Mutation) => Promise<boolean>;
export const singular: Record<Kind, string> = {
  contacts: "contact",
  companies: "company",
  deals: "deal",
  tasks: "follow-up",
  notes: "note",
};
export function Choice({
  id,
  value,
  onChange,
  items,
  placeholder = "Choose…",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => onChange(v === "__none" ? "" : v)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value || "__none"} value={i.value || "__none"}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
export function RecordForm({
  kind,
  item,
  defaults = {},
  state,
  onClose,
  mutate,
  onArchive,
}: {
  kind: Kind;
  item?: RecordItem;
  defaults?: Record<string, unknown>;
  state: State;
  onClose: () => void;
  mutate: Mutate;
  onArchive?: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...{
      name: "",
      companyId: "",
      contactId: "",
      dealId: "",
      email: "",
      phone: "",
      role: "",
      domain: "",
      industry: "",
      status: "Lead",
      stage: "New lead",
      pipelineId: "sales",
      custom: {},
      value: 0,
      closeDate: "",
      dueDate: "",
      description: "",
      completed: false,
      priority: "Normal",
    },
    ...defaults,
    ...item,
    value: item && "value" in item ? item.value / 100 : defaults.value || 0,
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) =>
    setValues((v) => ({ ...v, [key]: value }));
  const input = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`form-${key}`}>{label}</FieldLabel>
      <Input
        id={`form-${key}`}
        type={type}
        required={required}
        maxLength={200}
        value={String(values[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        {...(type === "number" ? { min: 0, step: "0.01" } : {})}
      />
    </Field>
  );
  const choice = (
    key: string,
    label: string,
    items: { value: string; label: string }[],
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`form-${key}`}>{label}</FieldLabel>
      <Choice
        id={`form-${key}`}
        value={String(values[key] || "")}
        onChange={(v) => set(key, v)}
        items={items}
      />
    </Field>
  );
  const options = (k: "companies" | "contacts" | "deals") => [
    { value: "", label: "None" },
    ...state[k].map((v) => ({ value: v.id, label: v.name })),
  ];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const keys = Object.keys(schemas[kind].shape);
      const raw = Object.fromEntries(keys.map((k) => [k, values[k]]));
      if (kind === "deals") raw.value = Math.round(Number(values.value) * 100);
      const data = schemas[kind].parse(raw);
      if (
        await mutate({
          action: item ? "update" : "create",
          kind,
          id: item?.id,
          version: item?.version,
          data,
        })
      )
        onClose();
    } catch (err) {
      setError(
        err instanceof z.ZodError
          ? err.issues[0].message
          : "Please check the form values.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit" : "New"} {singular[kind]}
          </DialogTitle>
          <DialogDescription>
            {kind === "notes"
              ? "Keep the context that matters."
              : "A little context makes the next conversation easier."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            {kind === "notes" ? (
              <Field>
                <FieldLabel htmlFor="form-name">Note</FieldLabel>
                <Textarea
                  id="form-name"
                  value={String(values.name)}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  maxLength={5000}
                  rows={5}
                />
              </Field>
            ) : (
              input(
                "name",
                kind === "tasks"
                  ? "What needs to happen?"
                  : kind === "deals"
                    ? "Deal name"
                    : "Name",
                "text",
                true,
              )
            )}
            {kind === "companies" && (
              <>
                {input("domain", "Website / domain")}
                {input("industry", "Industry")}
              </>
            )}
            {kind === "contacts" && (
              <>
                {input("email", "Email", "email")}
                <div className="grid grid-cols-2 gap-4">
                  {input("role", "Job title")}
                  {input("phone", "Phone", "tel")}
                </div>
                {choice("companyId", "Company", options("companies"))}
                {choice(
                  "status",
                  "Relationship",
                  ["Lead", "Customer", "Partner"].map((v) => ({
                    value: v,
                    label: v,
                  })),
                )}
              </>
            )}
            {kind === "deals" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {input("value", "Value (USD)", "number", true)}
                  {input("closeDate", "Expected close", "date")}
                </div>
                {choice("companyId", "Company", options("companies"))}
                {choice("contactId", "Primary contact", options("contacts"))}
                {choice(
                  "stage",
                  "Stage",
                  stages.map((v) => ({ value: v, label: v })),
                )}
                <Field>
                  <FieldLabel htmlFor="form-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="form-description"
                    value={String(values.description)}
                    onChange={(e) => set("description", e.target.value)}
                    maxLength={5000}
                  />
                </Field>
              </>
            )}
            {(kind === "tasks" || kind === "notes") && (
              <>
                {choice("contactId", "Contact", options("contacts"))}
                {choice("dealId", "Deal", options("deals"))}
              </>
            )}
            {kind === "tasks" && (
              <div className="grid grid-cols-2 gap-4">
                {input("dueDate", "Due date", "date")}
                {choice(
                  "priority",
                  "Priority",
                  ["Normal", "High"].map((v) => ({ value: v, label: v })),
                )}
              </div>
            )}
            <ProFields
              kind={kind}
              state={state}
              values={
                (values.custom || {}) as Record<
                  string,
                  string | number | boolean
                >
              }
              onChange={(custom) => set("custom", custom)}
            />
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            {item && onArchive && (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                disabled={busy}
                onClick={onArchive}
              >
                <Archive data-icon="inline-start" />
                Archive
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              )}
              {item ? "Save changes" : `Create ${singular[kind]}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
