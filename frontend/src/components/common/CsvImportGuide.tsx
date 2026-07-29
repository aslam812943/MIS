import React from 'react';
import { type CsvFieldSpec, downloadCsvTemplate } from '../../utils/csvBulkImportHelpers';

interface CsvImportGuideProps {
  fields: CsvFieldSpec[];
  templateFilename: string;
  missing?: string[];
  extra?: string[];
  sampleFileDetected?: boolean;
}

/**
 * Shared guideline + example-file download + validation-error display for
 * every department's "Bulk Import CSV" modal — tells the user exactly which
 * columns are required before they ever pick a file, and surfaces why an
 * uploaded file was rejected (missing/extra columns, or the untouched
 * example file) in the same place.
 */
const CsvImportGuide: React.FC<CsvImportGuideProps> = ({ fields, templateFilename, missing, extra, sampleFileDetected }) => {
  const hasError = Boolean((missing && missing.length > 0) || (extra && extra.length > 0) || sampleFileDetected);

  return (
    <div className="mis-card p-4 space-y-3" style={{ background: 'rgba(6, 182, 212, 0.06)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Required CSV Columns
          </h4>
          <p className="text-xs mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
            Your file's header row must contain exactly these columns — nothing missing, nothing extra.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsvTemplate(templateFilename, fields)}
          className="mis-btn mis-btn-ghost mis-btn-sm shrink-0"
        >
          📥 Download Example CSV
        </button>
      </div>

      <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
        {fields.map((f) => (
          <li key={f.key} className="mis-badge mis-badge-info" title={f.label}>{f.key}</li>
        ))}
      </ul>

      {hasError && (
        <div className="mis-alert mis-alert-error text-xs space-y-1">
          {sampleFileDetected && (
            <p className="m-0 font-bold">Can't import — this is the example file. Replace the sample row with your real data before uploading.</p>
          )}
          {missing && missing.length > 0 && (
            <p className="m-0"><strong>Missing columns:</strong> {missing.join(', ')}</p>
          )}
          {extra && extra.length > 0 && (
            <p className="m-0"><strong>Unrecognized columns:</strong> {extra.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CsvImportGuide;
