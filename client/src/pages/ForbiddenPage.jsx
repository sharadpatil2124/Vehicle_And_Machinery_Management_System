import { Link } from 'react-router-dom';
import { Card } from '../components/ui';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card title="Access denied">
        <p className="text-steel-600">Your role does not have permission to view this page.</p>
        <Link
          to="/dashboard"
          className="mt-4 inline-block font-semibold text-brand-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
