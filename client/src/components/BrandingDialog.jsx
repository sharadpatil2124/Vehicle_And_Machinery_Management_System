import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Modal } from './ui';
import { useBranding } from '../context/BrandingContext';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function BrandingDialog({ open, onClose }) {
  const { branding, logoUrl, saveTitle, uploadLogo, removeLogo } = useBranding();
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(branding?.dashboardTitle ?? '');
    setPendingFile(null);
    setRemoveRequested(false);
    setFileError(null);
    setError(null);
  }, [open, branding?.dashboardTitle]);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setFileError('Choose a PNG, JPG or WEBP image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFileError('The logo must be 2 MB or smaller.');
      return;
    }
    setFileError(null);
    setRemoveRequested(false);
    setPendingFile(file);
  }

  function handleRemove() {
    setPendingFile(null);
    setRemoveRequested(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (title.trim() !== (branding?.dashboardTitle ?? '')) await saveTitle(title.trim());
      if (pendingFile) await uploadLogo(pendingFile);
      else if (removeRequested && branding?.hasLogo) await removeLogo();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = pendingPreview ?? (removeRequested ? null : logoUrl);

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Branding"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{error}</Alert>

        <Field label="Title">
          {(props) => (
            <Input
              {...props}
              value={title}
              maxLength={150}
              placeholder="Optional"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <span className="mb-1 block text-sm font-semibold text-steel-700">Logo</span>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded border border-steel-200 bg-steel-50 p-1">
            {previewUrl ? (
              <img src={previewUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-steel-500">None</span>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
            {previewUrl ? 'Change' : 'Upload'}
          </Button>
          {previewUrl && (
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={saving} className="text-danger-600 hover:text-danger-600">
              Remove
            </Button>
          )}
        </div>
        <p className={`mt-1 text-xs ${fileError ? 'font-medium text-danger-600' : 'text-steel-500'}`}>
          {fileError ?? 'PNG, JPG or WEBP, max 2 MB'}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
