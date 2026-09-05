import { Card, RoleBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children}</dd>
    </div>
  );
}

export default function DashboardPage() {
  const { user, organization } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Dashboard</h1>
        <p className="mt-1 text-steel-500">
          Signed in to {organization?.organizationName}.
        </p>
      </div>

      <Card title="Your account">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Detail label="Name">{user?.name}</Detail>
          <Detail label="Email">{user?.email}</Detail>
          <Detail label="Role">
            <RoleBadge role={user?.role} />
          </Detail>
          <Detail label="Organization">{organization?.organizationName}</Detail>
        </dl>
      </Card>
    </div>
  );
}
