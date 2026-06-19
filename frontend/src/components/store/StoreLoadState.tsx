import BackHomeLink from '@/components/ui/BackHomeLink';
import Button from '@/components/ui/Button';
import { isRetryableStoreError } from '@/lib/store-api';

interface StoreLoadStateProps {
  loading: boolean;
  error: string;
  /** When loading the sub-reseller signup form, show signup-specific copy. */
  context?: 'store' | 'signup';
  onRetry?: () => void;
}

function storeErrorCopy(error: string, context: StoreLoadStateProps['context'] = 'store') {
  const lower = error.toLowerCase();
  if (context === 'signup') {
    if (lower.includes('not found')) {
      return {
        title: 'Store not found',
        message:
          'We could not find a store at this link. Please check the address or ask your reseller for the correct store link.',
      };
    }
    return {
      title: 'Unable to load signup',
      message: error || 'Something went wrong while opening the reseller signup form. Please try again later.',
    };
  }
  if (lower.includes('unavailable') || lower.includes('disabled') || lower.includes('not open')) {
    return {
      title: 'Store unavailable',
      message:
        'This store is not open right now. Please check back later or contact the person who shared the link with you.',
    };
  }
  if (lower.includes('not found')) {
    return {
      title: 'Store not found',
      message:
        'We could not find a store at this link. Please check the address or ask your reseller for the correct store link.',
    };
  }
  return {
    title: 'Unable to open store',
    message: error || 'Something went wrong while loading this store. Please try again later.',
  };
}

export default function StoreLoadState({ loading, error, context = 'store', onRetry }: StoreLoadStateProps) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-gray-400">
        Loading store...
      </div>
    );
  }

  if (error) {
    const copy = storeErrorCopy(error, context);
    const showRetry = Boolean(onRetry && isRetryableStoreError(error));
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-navy px-4 text-center">
        <div className="max-w-md bg-white rounded-xl p-8 shadow-xl">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{copy.title}</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">{copy.message}</p>
          <div className="flex flex-col gap-3">
            {showRetry && (
              <Button type="button" className="w-full" onClick={onRetry}>
                Try again
              </Button>
            )}
            <BackHomeLink variant="onLight" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
