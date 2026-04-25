/* eslint-disable */
import { config as dotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv({
  path: "../../.env",
});

export default defineConfig({
  out: "./drizzle",
  schema: "./src/DbSchema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
