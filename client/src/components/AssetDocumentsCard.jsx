import { useCallback, useEffect, useRef, useState } from 'react';
import { assetDocumentsApi } from '../api/client';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui';
import { DOCUMENT_LABELS, MAX_DOCUMENT_SIZE_MB } from '../config/assetDocuments';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DocumentRow({ assetType, assetId, slot, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
      setError(`File is too large — the limit is ${MAX_DOCUMENT_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await assetDocumentsApi.upload(assetType, assetId, slot.docType, file);
      await onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      await assetDocumentsApi.download(assetType, assetId, slot.docType, slot.document?.originalFilename);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded border border-steel-200 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-steel-900">{DOCUMENT_LABELS[slot.docType]}</span>
          <Badge tone="neutral">{slot.mandatory ? 'Required' : 'Optional'}</Badge>
          {slot.uploaded && <Badge tone="success">Uploaded</Badge>}
          {!slot.uploaded && slot.mandatory && <Badge tone="warning">Missing</Badge>}
        </div>
        {slot.uploaded ? (
          <>
            <p className="truncate text-xs text-steel-600" title={slot.document.originalFilename}>
              {slot.document.originalFilename}
            </p>
            <p className="truncate text-xs text-steel-400">
              {slot.document.uploadedByName ? `${slot.document.uploadedByName} · ` : ''}
              {formatDate(slot.document.updatedAt)}
            </p>
          </>
        ) : (
          <p className="text-xs text-steel-400">Not uploaded yet</p>
        )}
        {error && <p className="text-xs font-medium text-danger-600">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {slot.uploaded && (
          <Button variant="secondary" size="sm" loading={downloading} onClick={handleDownload}>
            Download
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
          {slot.uploaded ? 'Replace' : 'Upload'}
        </Button>
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

export default function AssetDocumentsCard({ assetType, assetId }) {
  const [slots, setSlots] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await assetDocumentsApi.list(assetType, assetId);
      setSlots(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [assetType, assetId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card title="Documents" className="mt-4">
      {loadError && <Alert tone="error">{loadError}</Alert>}
      {!slots ? (
        <Spinner label="Loading documents" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => (
            <DocumentRow key={slot.docType} assetType={assetType} assetId={assetId} slot={slot} onUploaded={load} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-steel-400">Accepted formats: PDF, JPG or PNG — up to 10MB.</p>
    </Card>
  );
}
