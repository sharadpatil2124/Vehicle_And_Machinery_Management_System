import { useEffect, useState } from 'react';
import { tyresApi } from '../../api/client';
import { Alert, Button, Field, Input, Modal } from '../ui';

export default function TyreTypeModal({ open, tyreType = null, onClose, onSaved }) {
  const [form, setForm] = useState({ brand: '', pattern: '', size: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ brand: tyreType?.brand ?? '', pattern: tyreType?.pattern ?? '', size: tyreType?.size ?? '' });
    setErrors({});
    setError(null);
  }, [open, tyreType]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {
      brand: form.brand.trim() ? null : 'Enter the brand, e.g. Apollo.',
      size: form.size.trim() ? null : 'Enter the size, e.g. 215/75 R15.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = { brand: form.brand, pattern: form.pattern || null, size: form.size };
      const response = tyreType ? await tyresApi.updateType(tyreType.id, payload) : await tyresApi.createType(payload);
      onSaved(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tyreType ? `Edit ${tyreType.typeCode}` : 'New tyre type'} description="A tyre type is a brand, pattern and size you buy. Set it up once and reuse it.">
      {open && (
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{error}</Alert>
          <Field label="Brand" required error={errors.brand}>
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={form.brand} onChange={update('brand')} maxLength={100} placeholder="e.g. Apollo" />}
          </Field>
          <Field label="Pattern / model">
            {({ id }) => <Input id={id} value={form.pattern} onChange={update('pattern')} maxLength={100} placeholder="e.g. Amazer 4G" />}
          </Field>
          <Field label="Size" required error={errors.size}>
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={form.size} onChange={update('size')} maxLength={50} placeholder="e.g. 215/75 R15" />}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {tyreType ? 'Save changes' : 'Add tyre type'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
