import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-steel-100 px-4">
      <div className="w-full max-w-md rounded border border-steel-200 bg-white px-7 py-8 text-center">
        <h1 className="text-lg font-semibold text-steel-900">Page not found</h1>
        <p className="mt-2 text-steel-500">
          That address does not match any page in this application.
        </p>
        <Link
          to={destination}
          className="mt-5 inline-block font-semibold text-brand-600 hover:underline"
        >
          {isAuthenticated ? 'Back to dashboard' : 'Go to sign in'}
        </Link>
      </div>
    </div>
  );
}
