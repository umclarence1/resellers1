import BrandLogo from '@/components/ui/BrandLogo';
import BackHomeLink from '@/components/ui/BackHomeLink';
import { ReactNode } from 'react';

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="mb-6">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-gray-400 mt-2">{subtitle}</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-xl shadow-black/20 p-6">
          {children}
        </div>

        <div className="mt-5 text-center">
          <BackHomeLink />
        </div>
      </div>
    </div>
  );
}
