import { Navigate, useParams } from 'react-router-dom';
import { buildStoreHomePath, buildStoreBuyPath } from '@/lib/reseller-store-ref';

export function StoreHomeRedirect() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <Navigate to={buildStoreHomePath(slug)} replace />;
}

export function StoreBuyRedirect() {
  const { slug, network } = useParams();
  if (!slug || !network) return <Navigate to="/" replace />;
  return <Navigate to={buildStoreBuyPath(slug, decodeURIComponent(network))} replace />;
}
