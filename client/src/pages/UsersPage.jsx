import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '../api/client';
import { Alert, Badge, Button, Card, Field, Input, Modal, RoleBadge, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status}</Badge>;
}

function AccountDetails({ account }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Name</dt>
        <dd className="mt-0.5 text-steel-900">{account.name}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Email</dt>
        <dd className="mt-0.5 break-all text-steel-900">{account.email}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Status</dt>
        <dd className="mt-0.5">
          <StatusBadge status={account.status} />
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Last sign-in</dt>
        <dd className="mt-0.5 text-steel-900">{formatDate(account.lastLoginAt)}</dd>
      </div>
    </dl>
  );
}

function SupervisorForm({ mode, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({ name: initial?.name ?? '', email: initial?.email ?? '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response =
        mode === 'create'
          ? await usersApi.createSupervisor(form)
          : await usersApi.updateSupervisor(form);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const emailChanged = mode === 'edit' && form.email.trim() !== initial?.email;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <Field label="Name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="name"
            value={form.name}
            onChange={update('name')}
            required
          />
        )}
      </Field>

      <Field
        label="Email"
        required
        hint={
          mode === 'create'
            ? 'They will receive a link to set their own password.'
            : emailChanged
              ? 'Changing the email sends a new set-password link and signs out the previous holder.'
              : undefined
        }
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="email"
            name="email"
            value={form.email}
            onChange={update('email')}
            required
          />
        )}
      </Field>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create supervisor' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mode, setMode] = useState('view');
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await usersApi.list();
      setAccounts(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const admin = accounts?.find((account) => account.role === 'admin') ?? null;
  const supervisor = accounts?.find((account) => account.role === 'supervisor') ?? null;

  async function handleSaved(message) {
    setMode('view');
    setNotice(message);
    await load();
  }

  async function toggleSupervisorStatus() {
    setStatusPending(true);
    try {
      const next = supervisor.status === 'active' ? 'inactive' : 'active';
      const response = await usersApi.setSupervisorStatus(next);
      setNotice(response.message);
      setConfirmingStatus(false);
      await load();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setStatusPending(false);
    }
  }

  if (loadError && !accounts) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tone="error">{loadError}</Alert>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (!accounts) {
    return <Spinner label="Loading accounts" />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Organization users</h1>
        <p className="mt-1 text-steel-500">
          Every organization has one admin and one supervisor.
        </p>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {loadError && <Alert tone="error">{loadError}</Alert>}

      <div className="grid gap-4">
        <Card
          title="Admin"
          subtitle="The primary account for this organization"
          actions={<RoleBadge role="admin" />}
        >
          {admin ? <AccountDetails account={admin} /> : <p className="text-steel-500">Not found.</p>}
          {admin?.id === currentUser?.id && (
            <p className="mt-4 border-t border-steel-200 pt-3 text-xs text-steel-500">
              This is your account. The admin account cannot be deactivated — it would lock the
              organization out of its own management.
            </p>
          )}
        </Card>

        <Card
          title="Supervisor"
          subtitle="Can create and edit records, but cannot delete or export"
          actions={
            supervisor ? (
              <div className="flex items-center gap-2">
                <RoleBadge role="supervisor" />
                {mode === 'view' && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setMode('edit')}>
                      Edit
                    </Button>
                    <Button
                      variant={supervisor.status === 'active' ? 'danger' : 'primary'}
                      size="sm"
                      onClick={() => setConfirmingStatus(true)}
                    >
                      {supervisor.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </>
                )}
              </div>
            ) : null
          }
        >
          {mode === 'create' && (
            <SupervisorForm mode="create" onCancel={() => setMode('view')} onSaved={handleSaved} />
          )}

          {mode === 'edit' && supervisor && (
            <SupervisorForm
              mode="edit"
              initial={supervisor}
              onCancel={() => setMode('view')}
              onSaved={handleSaved}
            />
          )}

          {mode === 'view' &&
            (supervisor ? (
              <AccountDetails account={supervisor} />
            ) : (
              <div className="py-6 text-center">
                <p className="text-steel-500">
                  This organization does not have a supervisor yet.
                </p>
                <Button className="mt-4" onClick={() => setMode('create')}>
                  Create supervisor
                </Button>
              </div>
            ))}
        </Card>
      </div>

      <Modal
        open={confirmingStatus}
        onClose={() => setConfirmingStatus(false)}
        title={supervisor?.status === 'active' ? 'Deactivate supervisor?' : 'Reactivate supervisor?'}
        description={
          supervisor?.status === 'active'
            ? `${supervisor?.name} will be signed out on their next request and will not be able to sign in again until reactivated.`
            : `${supervisor?.name} will be able to sign in again.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingStatus(false)}>
              Cancel
            </Button>
            <Button
              variant={supervisor?.status === 'active' ? 'danger' : 'primary'}
              loading={statusPending}
              onClick={toggleSupervisorStatus}
            >
              {supervisor?.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />
    </div>
  );
}
