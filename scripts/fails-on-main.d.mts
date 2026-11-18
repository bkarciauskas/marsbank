export interface PrClassification {
  required: boolean;
  reason: string;
}

export interface VitestRunResult {
  ok: boolean;
  status: number;
  output: string;
}

export interface FailsOnMainResult {
  ok: boolean;
  skipped: boolean;
  reason: string;
  changedFiles: string[];
  testFiles: string[];
  baseLabel: string;
  headRun?: VitestRunResult;
  baseRun?: VitestRunResult;
}

export function isTestFile(filePath: string): boolean;
export function isOverlayHelperFile(filePath: string): boolean;
export function isDocsFile(filePath: string): boolean;

export function classifyPr(input: {
  title?: string;
  labels?: string[];
  headRef?: string;
  changedFiles?: string[];
}): PrClassification;

export function resolveChangedFiles(options: {
  repoRoot: string;
  baseRef: string;
  headRef: string;
}): string[];

export function runVitest(options: {
  cwd: string;
  testFiles: string[];
  vitestBin: string;
}): VitestRunResult;

export function evaluateFailsOnMain(options?: {
  repoRoot?: string;
  title?: string;
  labels?: string[];
  headRef?: string;
  baseCommit?: string;
  diffBase?: string;
  diffHead?: string;
  baseLabel?: string;
  vitestBin?: string;
}): FailsOnMainResult;
