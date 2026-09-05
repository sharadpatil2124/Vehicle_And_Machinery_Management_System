import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { Alert, Button, Field, Input } from '../components/ui';
import AuthShell from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await authApi.requestPasswordReset({ email });
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to choose a new password"
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {message ? (
        <Alert tone="success">{message}</Alert>
      ) : (
        <>
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              )}
            </Field>

            <Button type="submit" fullWidth loading={submitting}>
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
