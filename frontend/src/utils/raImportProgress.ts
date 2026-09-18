export type RAImportResult = { inserted: number; failed: Array<{ row: number; error: string }> };
export type RAImportProgress = { total: number; saved: number; processed: number; failed: number };

// Count only rows confirmed by completed database requests.
export async function uploadRaClientsInBatches(
  rows: Record<string, unknown>[],
  saveBatch: (rows: Record<string, unknown>[]) => Promise<RAImportResult>,
  onProgress: (progress: RAImportProgress) => void,
): Promise<RAImportResult> {
  const result: RAImportResult = { inserted: 0, failed: [] };
  onProgress({ total: rows.length, saved: 0, processed: 0, failed: 0 });
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    try {
      const response = await saveBatch(batch);
      if (response.inserted + response.failed.length !== batch.length) throw new Error('The server returned an incomplete saved count.');
      result.inserted += response.inserted;
      result.failed.push(...response.failed.map(failure => ({
        row: failure.row + offset,
        error: failure.error.replace(/matches row (\d+)/, (_, row) => `matches row ${Number(row) + offset}`),
      })));
      onProgress({ total: rows.length, saved: result.inserted, processed: offset + batch.length, failed: result.failed.length });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error || (error as Error).message || 'Request interrupted.';
      for (let index = offset; index < rows.length; index++) result.failed.push({
        row: index + 2,
        error: index < offset + batch.length ? `Save not confirmed: ${message} Check the directory before retrying.` : 'Not sent because the upload was interrupted.',
      });
      onProgress({ total: rows.length, saved: result.inserted, processed: offset + batch.length, failed: result.failed.length });
      break;
    }
  }
  return result;
}
