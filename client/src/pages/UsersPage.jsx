import { useCallback, useEffect, useState } from 'react';
import { usersApi, sitesApi } from '../api/client';
import { Alert, Badge, Button, Card, Field, Input, Modal, RoleBadge, Select, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status}</Badge>;
}

function AccountDetails({ account, siteName }) {
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
      {account.role === 'supervisor' && (
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Assigned site</dt>
          <dd className="mt-0.5">
            {account.siteId ? (
              <span className="text-steel-900">{siteName ?? `Site #${account.siteId}`}</span>
            ) : (
              <span className="text-danger-600">
                No site assigned — this supervisor cannot see any site data until you edit them and
                pick one.
              </span>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

function SupervisorForm({ mode, initial, sites, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    // A supervisor works at exactly one site, so this is always required.
    siteId: initial?.siteId ? String(initial.siteId) : '',
  });
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
          : await usersApi.updateSupervisor(initial.id, form);
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

      <Field
        label="Site"
        required
        hint="This supervisor will only be able to see and work with data from this one site."
      >
        {({ id, invalid, describedBy }) => (
          <Select
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="siteId"
            value={form.siteId}
            onChange={update('siteId')}
            required
          >
            <option value="">Select a site...</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.location ? `${site.name} — ${site.location}` : site.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {sites.length === 0 && (
        <Alert tone="warning">
          This organization has no active sites yet. Create a site first, then come back and add
          the supervisor.
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={sites.length === 0}>
          {mode === 'create' ? 'Create supervisor' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function SupervisorCard({ supervisor, sites, isEditing, isCreatingAnother, onEdit, onCancelEdit, onSaved, onRequestStatusChange }) {
  const siteName = sites.find((site) => site.id === supervisor.siteId)?.name;

  return (
    <Card
      title={isEditing ? 'Edit supervisor' : supervisor.name}
      subtitle={isEditing ? undefined : supervisor.email}
      actions={
        !isEditing && !isCreatingAnother ? (
          <div className="flex items-center gap-2">
            <RoleBadge role="supervisor" />
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant={supervisor.status === 'active' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => onRequestStatusChange(supervisor)}
            >
              {supervisor.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        ) : (
          <RoleBadge role="supervisor" />
        )
      }
    >
      {isEditing ? (
        <SupervisorForm
          mode="edit"
          initial={supervisor}
          sites={sites}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      ) : (
        <AccountDetails account={supervisor} siteName={siteName} />
      )}
    </Card>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [accounts, setAccounts] = useState(null);
  // Active sites of this organization — the Admin picks one of these for each supervisor.
  const [sites, setSites] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusPending, setStatusPending] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [usersResponse, sitesResponse] = await Promise.all([
        usersApi.list(),
        sitesApi.list({ limit: 100 }),
      ]);
      setAccounts(usersResponse.data);
      setSites(sitesResponse.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const admin = accounts?.find((account) => account.role === 'admin') ?? null;
  const supervisors = accounts?.filter((account) => account.role === 'supervisor') ?? [];

  async function handleSaved(message) {
    setEditingId(null);
    setCreating(false);
    setNotice(message);
    await load();
  }

  async function toggleStatus() {
    setStatusPending(true);
    try {
      const next = statusTarget.status === 'active' ? 'inactive' : 'active';
      const response = await usersApi.setSupervisorStatus(statusTarget.id, next);
      setNotice(response.message);
      setStatusTarget(null);
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Organization users</h1>
          <p className="mt-1 text-steel-500">One admin, and as many supervisors as the organization needs.</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>Add supervisor</Button>
        )}
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

        {creating && (
          <Card title="Add supervisor" actions={<RoleBadge role="supervisor" />}>
            <SupervisorForm
              mode="create"
              sites={sites}
              onCancel={() => setCreating(false)}
              onSaved={handleSaved}
            />
          </Card>
        )}

        {supervisors.map((supervisor) => (
          <SupervisorCard
            key={supervisor.id}
            supervisor={supervisor}
            sites={sites}
            isEditing={editingId === supervisor.id}
            isCreatingAnother={creating}
            onEdit={() => setEditingId(supervisor.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaved={handleSaved}
            onRequestStatusChange={setStatusTarget}
          />
        ))}

        {!creating && supervisors.length === 0 && (
          <Card title="Supervisors" subtitle="Can create and edit records, but cannot delete or export">
            <div className="py-6 text-center">
              <p className="text-steel-500">This organization does not have any supervisors yet.</p>
              <Button className="mt-4" onClick={() => setCreating(true)}>
                Add supervisor
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === 'active' ? 'Deactivate supervisor?' : 'Reactivate supervisor?'}
        description={
          statusTarget?.status === 'active'
            ? `${statusTarget?.name} will be signed out on their next request and will not be able to sign in again until reactivated.`
            : `${statusTarget?.name} will be able to sign in again.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={statusTarget?.status === 'active' ? 'danger' : 'primary'}
              loading={statusPending}
              onClick={toggleStatus}
            >
              {statusTarget?.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />
    </div>
  );
}
