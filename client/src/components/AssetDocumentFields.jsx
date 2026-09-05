import { useRef, useState } from 'react';
import { Badge, Button } from './ui';
import {
  DOC_TYPES,
  DOCUMENT_LABELS,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_MB,
  getMandatoryDocTypes,
} from '../config/assetDocuments';

function DocumentPickerRow({ docType, file, mandatory, missing, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;

    if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(selected.type)) {
      setError('Only PDF, JPG or PNG files are accepted');
      return;
    }
    if (selected.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
      setError(`File is too large — the limit is ${MAX_DOCUMENT_SIZE_MB}MB`);
      return;
    }
    setError(null);
    onChange(selected);
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-steel-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-steel-900">{DOCUMENT_LABELS[docType]}</span>
          <Badge tone={missing ? 'danger' : 'neutral'}>{mandatory ? 'Required' : 'Optional'}</Badge>
          {file && <Badge tone="success">Selected</Badge>}
        </div>
        <p className="mt-0.5 truncate text-sm text-steel-500">{file ? file.name : 'No file selected'}</p>
        {error && <p className="mt-0.5 text-sm font-medium text-danger-600">{error}</p>}
        {!error && missing && (
          <p className="mt-0.5 text-sm font-medium text-danger-600">This document is required</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          {file ? 'Change' : 'Choose file'}
        </Button>
        {file && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

export default function AssetDocumentFields({ assetType, files, onChange, showRequiredError }) {
  const mandatoryDocTypes = getMandatoryDocTypes(assetType);

  return (
    <div className="mt-6 border-t border-steel-200 pt-5">
      <h2 className="mb-3 text-sm font-semibold text-steel-900">Documents</h2>
      <div>
        {DOC_TYPES.map((docType) => {
          const mandatory = mandatoryDocTypes.includes(docType);
          const file = files[docType] ?? null;
          return (
            <DocumentPickerRow
              key={docType}
              docType={docType}
              file={file}
              mandatory={mandatory}
              missing={showRequiredError && mandatory && !file}
              onChange={(nextFile) => onChange({ ...files, [docType]: nextFile })}
            />
          );
        })}
      </div>
    </div>
  );
}
