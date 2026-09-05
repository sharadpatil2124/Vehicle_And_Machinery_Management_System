import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Field, Input } from '../components/ui';
import AuthShell from './AuthShell';

export default function LoginPage() {
  const { logIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const notice = location.state?.notice ?? null;

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await logIn(form);
      navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Sign in to your organization"
      footer={
        <>
          Need an organization? <Link to="/signup" className="font-semibold text-brand-600 hover:underline">Create one</Link>
        </>
      }
    >
      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email" required>
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

        <Field label="Password" required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          )}
        </Field>

        <div className="mb-4 -mt-2 text-right">
          <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
