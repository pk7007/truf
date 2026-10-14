import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    "prototype/**",
    ".next/**",
    ".data/**",
    ".vercel/**",
    "coverage/**",
    "dist/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);
