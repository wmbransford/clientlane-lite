import { betterAuth } from "better-auth";
import { db } from "./database";
export const auth = betterAuth({
  database: db,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4318",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:4318",
    "http://localhost:4318",
    "http://127.0.0.1:4318",
  ],
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
  session: { expiresIn: 60 * 60 * 24 * 7 },
});
