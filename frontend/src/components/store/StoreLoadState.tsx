import { Link } from 'react-router-dom';
import BackHomeLink from '@/components/ui/BackHomeLink';

interface StoreLoadStateProps {
  slug: string;
  loading: boolean;
  error: string;
}

export default function StoreLoadState({ slug, loading, error }: StoreLoadStateProps) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-gray-400">
        Loading store...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-navy px-4 text-center">
        <div className="max-w-md bg-white rounded-xl p-8 shadow-xl">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Store not found</h1>
          <p className="text-gray-600 mb-2">
            No active store exists at <span className="font-mono text-sm">/store/{slug}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Check the store link from your reseller. Demo store:{' '}
            <Link to="/store/fastdata-gh" className="text-amber-700 hover:underline font-medium">
              /store/fastdata-gh
            </Link>
          </p>
          <BackHomeLink />
        </div>
      </div>
    );
  }

  return null;
}
