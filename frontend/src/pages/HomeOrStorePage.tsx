import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import { readStoreRef } from '@/lib/reseller-store-ref';
import RouteFallback from '@/components/ui/RouteFallback';

const StoreHomePage = lazy(() => import('@/pages/store/StoreHomePage'));

/** Main domain: marketing home, or customer storefront when ?r=reseller-slug is present. */
export default function HomeOrStorePage() {
  const [searchParams] = useSearchParams();
  const slug = readStoreRef(searchParams);

  if (slug) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <StoreHomePage slugOverride={slug} mainDomain />
      </Suspense>
    );
  }

  return <HomePage />;
}
