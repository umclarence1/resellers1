import HomePage from '@/pages/HomePage';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Main domain home — legacy ?r= links redirect to /store/:slug. */
export default function HomeOrStorePage() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('r')?.trim();

  if (slug) {
    const tab = searchParams.get('tab');
    const paid = searchParams.get('paid');
    const extra: Record<string, string> = {};
    if (tab) extra.tab = tab;
    if (paid) extra.paid = paid;
    const query = new URLSearchParams(extra).toString();
    const target = `/store/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`;
    return <Navigate to={target} replace />;
  }

  return <HomePage />;
}
