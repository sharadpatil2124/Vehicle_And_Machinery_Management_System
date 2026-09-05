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

export default function SignupPage() {
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  };

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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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

        <Button type="submit" fullWidth loading={submitting}>
          Create organization
        </Button>
      </form>
    </AuthShell>
  );
}
