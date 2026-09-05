import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal } from './ui';

export default function DeleteWordModal({
  open,
  title = 'Delete this record?',
  description,
  onCancel,
  onConfirm,
  pending = false,
  error = null,
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) setValue('');
  }, [open]);

  const matches = value === 'DELETE';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!matches} loading={pending} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>
      <label className="mb-1.5 block text-sm font-semibold text-steel-700">
        Type <span className="font-mono font-bold">DELETE</span> to confirm
      </label>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="DELETE"
        autoComplete="off"
        autoFocus
      />
    </Modal>
  );
}
