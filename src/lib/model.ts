import { z } from "zod";
import { customValues, type WorkspaceSettings } from "./workspace-settings";
export const stages = [
  "New lead",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type Stage = (typeof stages)[number];
export const kinds = [
  "companies",
  "contacts",
  "deals",
  "tasks",
  "notes",
] as const;
export type Kind = (typeof kinds)[number];
const text = z.string().trim().max(200);
const name = text.min(1, "A name is required");
const ref = z.string().max(100).default("");
const date = z.union([z.literal(""), z.iso.date()]).default("");
export const schemas = {
  companies: z
    .object({
      name,
      domain: text.default(""),
      industry: text.default(""),
      custom: customValues.optional(),
    })
    .strict(),
  contacts: z
    .object({
      name,
      custom: customValues.optional(),
      email: z.union([z.literal(""), z.email()]).default(""),
      phone: text.default(""),
      role: text.default(""),
      companyId: ref,
      status: z.enum(["Lead", "Customer", "Partner"]).default("Lead"),
    })
    .strict(),
  deals: z
    .object({
      name,
      companyId: ref,
      contactId: ref,
      custom: customValues.optional(),
      pipelineId: z.string().min(1).max(100).optional(),
      value: z.number().int().min(0).max(100000000000),
      stage: z.enum(stages).default("New lead"),
      closeDate: date,
      description: z.string().trim().max(5000).default(""),
    })
    .strict(),
  tasks: z
    .object({
      name,
      contactId: ref,
      dealId: ref,
      dueDate: date,
      completed: z.boolean().default(false),
      priority: z.enum(["Normal", "High"]).default("Normal"),
    })
    .strict(),
  notes: z
    .object({
      name: z.string().trim().min(1).max(5000),
      contactId: ref,
      dealId: ref,
    })
    .strict(),
};
export type Company = z.infer<typeof schemas.companies> & Meta;
export type Contact = z.infer<typeof schemas.contacts> & Meta;
export type Deal = z.infer<typeof schemas.deals> & Meta;
export type Task = z.infer<typeof schemas.tasks> & Meta;
export type Note = z.infer<typeof schemas.notes> & Meta;
export type Meta = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type RecordItem = Company | Contact | Deal | Task | Note;
export type ArchivedRecord = {
  kind: Kind;
  record: RecordItem;
  archivedAt: string;
};
export type Activity = {
  id: string;
  message: string;
  createdAt: string;
  recordId: string;
};
export type State = {
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  tasks: Task[];
  notes: Note[];
  archived: ArchivedRecord[];
  activity: Activity[];
  workspace: { name: string; edition: "Lite" | "Pro" };
  settings: WorkspaceSettings;
  settingsVersion: number;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function displayDate(value: string) {
  return value
    ? new Date(
        value.includes("T") ? value : `${value}T12:00:00`,
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No date";
}
