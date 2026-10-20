import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const useBankInstead =
  "Pages and components do not open the ledger. Read it with useBank() from @/lib/store, or add a route handler under app/api that calls getLedgerRepository().";

const postgresOnly =
  "Open Postgres only in lib/server/ledger-repository.ts. Route handlers call getLedgerRepository().";

const domainStaysPure =
  "Domain modules stay free of React, Next, and the database. Put I/O in lib/server or app/api, and UI in components/ or app/.";

const wholeTokens =
  "Model tokens are whole numbers. Use parseTokenInput() or tokens() from @/lib/money.";

const noAny =
  "Do not use `as any`. Brand an amount with tokens() from @/lib/money, or narrow with a type guard.";

const tokenSyntax = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: wholeTokens,
  },
  {
    selector: "CallExpression[callee.name='parseInt']",
    message: wholeTokens,
  },
  {
    selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
    message: noAny,
  },
  {
    selector: "TSTypeAssertion[typeAnnotation.type='TSAnyKeyword']",
    message: noAny,
  },
];

const serverPatterns = [
  {
    group: [
      "@/lib/server",
      "@/lib/server/*",
      "@/lib/server/**",
      "**/lib/server",
      "**/lib/server/*",
      "**/lib/server/**",
    ],
    message: useBankInstead,
  },
];

const domainFiles = [
  "lib/money.ts",
  "lib/domain.ts",
  "lib/ledger.ts",
  "lib/ids.ts",
  "lib/payid.ts",
  "lib/sol.ts",
  "lib/daypart.ts",
  "lib/fixtures.ts",
  "lib/flow-report.ts",
  "lib/statement-csv.ts",
  "lib/shared-ledger.ts",
  "lib/theme.ts",
];

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    ".next-shots/**",
    "capture/**",
    "public/assets/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/server/ledger-repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "postgres", message: postgresOnly }] },
      ],
      "no-restricted-syntax": ["error", ...tokenSyntax],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "postgres", message: postgresOnly }],
          patterns: serverPatterns,
        },
      ],
    },
  },
  {
    files: domainFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "postgres", message: postgresOnly },
            { name: "react", message: domainStaysPure },
            { name: "react-dom", message: domainStaysPure },
          ],
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "@/lib/server",
                "@/lib/server/*",
                "@/lib/server/**",
                "@/app",
                "@/app/*",
                "@/components",
                "@/components/*",
              ],
              message: domainStaysPure,
            },
          ],
        },
      ],
    },
  },
]);
