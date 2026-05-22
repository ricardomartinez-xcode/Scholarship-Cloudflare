export type ImportRecord = Record<string, string | number | null>;

export type ImportSummary = {
  rowsRead: number;
  valid: number;
  invalid: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; column: string; message: string }>;
};
