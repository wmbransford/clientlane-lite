import { z } from "zod";
export const settingsId = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(80);
export const pipelineSchema = z.object({ id: settingsId, name }).strict();
export const fieldSchema = z
  .object({
    id: settingsId,
    name,
    kind: z.enum(["contacts", "companies", "deals"]),
    type: z.enum(["text", "number", "date", "checkbox", "select"]),
    options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  })
  .strict()
  .refine(
    (field) =>
      field.type !== "select" ||
      (field.options.length > 0 &&
        new Set(field.options).size === field.options.length),
    "Select fields need distinct options.",
  );
export const viewSchema = z
  .object({
    id: settingsId,
    name,
    kind: z.enum(["contacts", "companies", "deals", "tasks"]),
    query: z.string().max(200).default(""),
    pipelineId: z.string().max(100).default("sales"),
    status: z.string().max(80).default("all"),
  })
  .strict();
export const ruleSchema = z
  .object({
    id: settingsId,
    name,
    pipelineId: settingsId,
    stage: z.enum([
      "New lead",
      "Qualified",
      "Proposal",
      "Negotiation",
      "Won",
      "Lost",
    ]),
    taskName: z.string().trim().min(1).max(180),
    days: z.number().int().min(0).max(365),
    enabled: z.boolean().default(true),
  })
  .strict();
export const settingsSchema = z
  .object({
    pipelines: z.array(pipelineSchema).min(1).max(20),
    fields: z.array(fieldSchema).max(50),
    views: z.array(viewSchema).max(30),
    rules: z.array(ruleSchema).max(30),
  })
  .strict()
  .superRefine((settings, ctx) => {
    for (const key of ["pipelines", "fields", "views", "rules"] as const) {
      if (
        new Set(settings[key].map((item) => item.id)).size !==
        settings[key].length
      )
        ctx.addIssue({
          code: "custom",
          message: `Duplicate ${key} IDs.`,
          path: [key],
        });
    }
    if (!settings.pipelines.some((pipeline) => pipeline.id === "sales"))
      ctx.addIssue({
        code: "custom",
        message: "Keep the default sales pipeline.",
        path: ["pipelines"],
      });
    for (const item of [
      ...settings.views.filter((view) => view.kind === "deals"),
      ...settings.rules,
    ]) {
      if (
        !settings.pipelines.some((pipeline) => pipeline.id === item.pipelineId)
      )
        ctx.addIssue({
          code: "custom",
          message: "A view or rule refers to a missing pipeline.",
        });
    }
  });
export type WorkspaceSettings = z.infer<typeof settingsSchema>;
export type CustomField = WorkspaceSettings["fields"][number];
export const defaultSettings = (): WorkspaceSettings => ({
  pipelines: [{ id: "sales", name: "Sales pipeline" }],
  fields: [],
  views: [],
  rules: [],
});
export const customValues = z
  .record(
    z.string().min(1).max(100),
    z.union([z.string().max(2000), z.number().finite(), z.boolean()]),
  )
  .refine(
    (values) => Object.keys(values).length <= 50,
    "Too many custom values.",
  )
  .transform((values) =>
    Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== ""),
    ),
  );
export function validateCustomValues(
  settings: WorkspaceSettings,
  kind: string,
  values: Record<string, string | number | boolean> = {},
) {
  for (const [id, value] of Object.entries(values)) {
    const field = settings.fields.find(
      (field) => field.id === id && field.kind === kind,
    );
    if (!field)
      throw new Error(
        "A custom field is no longer available. Refresh and try again.",
      );
    if (value === "") continue;
    const valid =
      field.type === "number"
        ? typeof value === "number" && Number.isFinite(value)
        : field.type === "checkbox"
          ? typeof value === "boolean"
          : field.type === "date"
            ? z.iso.date().safeParse(value).success
            : field.type === "select"
              ? typeof value === "string" && field.options.includes(value)
              : typeof value === "string";
    if (!valid) throw new Error(`Check the value for ${field.name}.`);
  }
}
