import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import { Alert, Button, Field, Input, Spinner } from '../components/ui';
import AuthShell from './AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [tokenState, setTokenState] = useState('checking');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      return;
    }

    let active = true;

    authApi
      .checkResetToken(token)
      .then((response) => {
        if (active) setTokenState(response.data.valid ? 'valid' : 'invalid');
      })
      .catch((err) => {
        if (active) setTokenState(err.status === 0 ? 'unreachable' : 'invalid');
      });

    return () => {
      active = false;
    };
  }, [token]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  function validate() {
    const errors = {};

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
      await authApi.resetPassword({ token, password: form.password });
      navigate('/login', {
        replace: true,
        state: { notice: 'Password updated. You can now sign in.' },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenState === 'checking') {
    return (
      <AuthShell title="Set your password" subtitle="Checking your link">
        <Spinner label="Checking link" />
      </AuthShell>
    );
  }

  if (tokenState === 'unreachable') {
    return (
      <AuthShell
        title="Cannot reach the server"
        subtitle="The link itself may still be fine"
        footer={
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="error">
          Cannot reach the server. Make sure the API is running, then reload this page.
        </Alert>
      </AuthShell>
    );
  }

  if (tokenState === 'invalid') {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This link cannot be used"
        footer={
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="error">
          This link is invalid, has already been used, or has expired.
        </Alert>
        <Link
          to="/forgot-password"
          className="block text-center font-semibold text-brand-600 hover:underline"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set your password" subtitle="Choose a password for your account">
      <Alert tone="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="New password"
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
          Set password
        </Button>
      </form>
    </AuthShell>
  );
}
