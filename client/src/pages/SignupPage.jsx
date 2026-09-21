import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Field, Input } from '../components/ui';
import AuthShell from './AuthShell';

const MIN_PASSWORD_LENGTH = 8;

const EMPTY_FORM = {
  organizationName: '',
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function emptySupervisorRow() {
  return { key: crypto.randomUUID(), name: '', email: '' };
}

export default function SignupPage() {
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [supervisors, setSupervisors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [supervisorErrors, setSupervisorErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  function updateSupervisor(key, field) {
    return (event) => {
      const value = event.target.value;
      setSupervisors((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
      setSupervisorErrors((errors) => ({ ...errors, [key]: { ...errors[key], [field]: undefined } }));
    };
  }

  function addSupervisorRow() {
    setSupervisors((rows) => [...rows, emptySupervisorRow()]);
  }

  function removeSupervisorRow(key) {
    setSupervisors((rows) => rows.filter((row) => row.key !== key));
    setSupervisorErrors((errors) => {
      const next = { ...errors };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const errors = {};

    if (!form.organizationName.trim()) errors.organizationName = 'Organization name is required';
    if (!form.name.trim()) errors.name = 'Your name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (form.confirmPassword !== form.password) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // A row left completely blank is just an unused "add another" slot and is
    // silently skipped; a row with only one side filled in is a mistake worth
    // flagging rather than silently dropping.
    const supErrors = {};
    for (const row of supervisors) {
      const hasName = row.name.trim();
      const hasEmail = row.email.trim();
      if (!hasName && !hasEmail) continue;
      const rowErrors = {};
      if (!hasName) rowErrors.name = 'Name is required';
      if (!hasEmail) rowErrors.email = 'Email is required';
      if (Object.keys(rowErrors).length > 0) supErrors[row.key] = rowErrors;
    }

    setFieldErrors(errors);
    setSupervisorErrors(supErrors);
    return Object.keys(errors).length === 0 && Object.keys(supErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp({
        organizationName: form.organizationName,
        name: form.name,
        email: form.email,
        password: form.password,
        supervisors: supervisors
          .filter((row) => row.name.trim() || row.email.trim())
          .map((row) => ({ name: row.name.trim(), email: row.email.trim() })),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your organization"
      subtitle="Create your organization and admin account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Organization name" error={fieldErrors.organizationName} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              name="organizationName"
              autoComplete="organization"
              value={form.organizationName}
              onChange={update('organizationName')}
              required
            />
          )}
        </Field>

        <Field label="Your name" error={fieldErrors.name} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={update('name')}
              required
            />
          )}
        </Field>

        <Field label="Email" error={fieldErrors.email} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              required
            />
          )}
        </Field>

        <Field
          label="Password"
          error={fieldErrors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          required
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          )}
        </Field>

        <Field label="Confirm password" error={fieldErrors.confirmPassword} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              required
            />
          )}
        </Field>

        <div className="mt-6 border-t border-steel-200 pt-5">
          <h2 className="mb-1 text-sm font-semibold text-steel-900">Supervisors (optional)</h2>
          <p className="mb-3 text-xs text-steel-500">
            A supervisor works at one site, and no sites exist yet. Anyone added here can sign in,
            but will not see any data until you create a site and assign it to them from
            Organization Users.
          </p>

          {supervisors.map((row, index) => (
            <div key={row.key} className="mb-3 rounded border border-steel-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-steel-500 uppercase">
                  Supervisor {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSupervisorRow(row.key)}
                  className="text-xs font-semibold text-danger-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              <Field label="Name" error={supervisorErrors[row.key]?.name}>
                {({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    describedBy={describedBy}
                    value={row.name}
                    onChange={updateSupervisor(row.key, 'name')}
                  />
                )}
              </Field>
              <Field label="Email" error={supervisorErrors[row.key]?.email}>
                {({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    describedBy={describedBy}
                    type="email"
                    value={row.email}
                    onChange={updateSupervisor(row.key, 'email')}
                  />
                )}
              </Field>
            </div>
          ))}

          <Button type="button" variant="secondary" onClick={addSupervisorRow}>
            Add a supervisor
          </Button>
        </div>

        <Button type="submit" fullWidth loading={submitting} className="mt-5">
          Create organization
        </Button>
      </form>
    </AuthShell>
  );
}
