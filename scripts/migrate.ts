import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { auth } = await import("../src/lib/auth");
  const { getMigrations } = await import("better-auth/db/migration");
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.log("Authentication and CRM database ready.");
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
