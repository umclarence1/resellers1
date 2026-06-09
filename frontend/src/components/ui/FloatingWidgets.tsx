import { useLocation } from 'react-router-dom';
import SupportLine from '@/components/ui/SupportLine';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';

export default function FloatingWidgets() {
  const { pathname } = useLocation();
  const hideWidgets =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dealer') ||
    pathname.startsWith('/reseller') ||
    pathname.startsWith('/store/');

  if (hideWidgets) return null;

  return (
    <>
      <SupportLine />
      <WhatsAppFloat />
    </>
  );
}
