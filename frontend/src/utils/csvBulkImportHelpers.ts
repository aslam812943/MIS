// Shared helpers for every department's "Bulk Import CSV" modal — keeps the
// guideline text, downloadable example file, and validation behavior
// consistent everywhere instead of each page inventing its own version.

export interface CsvFieldSpec {
  key: string;
  label: string;
}

// Placed in every cell of the example template's one sample row. If this
// marker is still present when the user clicks import, they uploaded the
// template unedited rather than their real data.
export const CSV_SAMPLE_SENTINEL = 'SAMPLE - replace before importing';

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const toCsvRow = (values: string[]) =>
  values.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

/** Triggers a browser download of a template CSV: field keys as headers, one sample row. */
export function downloadCsvTemplate(filename: string, fields: CsvFieldSpec[]): void {
  const headerRow = toCsvRow(fields.map((f) => f.key));
  const sampleRow = toCsvRow(fields.map(() => CSV_SAMPLE_SENTINEL));
  const csv = `${headerRow}\n${sampleRow}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface CsvHeaderValidation {
  valid: boolean;
  missing: string[];
  extra: string[];
}

/** Every required field must be present, and no unrecognized columns — a strict match. */
export function validateCsvHeaders(uploadedHeaders: string[], fields: CsvFieldSpec[]): CsvHeaderValidation {
  const normalizedUploaded = uploadedHeaders.map(normalizeHeader);
  const requiredNormalized = fields.map((f) => normalizeHeader(f.key));

  const missing = fields
    .filter((f) => !normalizedUploaded.includes(normalizeHeader(f.key)))
    .map((f) => f.key);

  const extra = uploadedHeaders.filter((h) => !requiredNormalized.includes(normalizeHeader(h)));

  return { valid: missing.length === 0 && extra.length === 0, missing, extra };
}

/** True if any cell in any row still contains the untouched sample marker. */
export function containsSampleSentinel(rows: string[][]): boolean {
  return rows.some((row) => row.some((cell) => String(cell ?? '').trim() === CSV_SAMPLE_SENTINEL));
}
