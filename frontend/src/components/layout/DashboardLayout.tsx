import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Package, ShoppingCart, MessageSquare,
  Wallet, Settings, LogOut, Code, Menu, X, Store,
  DollarSign, Bell, Phone,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dealers', label: 'Dealers', icon: Users },
  { href: '/admin/resellers', label: 'Resellers', icon: Store },
  { href: '/admin/packages', label: 'Packages', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Wallet },
  { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const dealerLinks = [
  { href: '/dealer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dealer/purchase', label: 'Buy Data', icon: ShoppingCart },
  { href: '/dealer/bulk', label: 'Bulk Purchase', icon: Package },
  { href: '/dealer/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dealer/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dealer/api', label: 'Developer API', icon: Code },
];

const resellerLinks = [
  { href: '/reseller', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reseller/store', label: 'My Store', icon: Store },
  { href: '/reseller/prices', label: 'Prices', icon: DollarSign },
  { href: '/reseller/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/reseller/withdrawals', label: 'Withdrawals', icon: Wallet },
  { href: '/reseller/complaints', label: 'Complaints', icon: MessageSquare },
];

export default function DashboardLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'admin' | 'dealer' | 'reseller';
}) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = role === 'admin' ? adminLinks : role === 'dealer' ? dealerLinks : resellerLinks;
  const portalName = role === 'admin' ? 'Admin Portal' : role === 'dealer' ? 'Dealer Portal' : 'Reseller Portal';

  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    const loginRoutes: Record<string, string> = {
      admin: '/login/admin',
      dealer: '/login/dealer',
      reseller: '/login/reseller',
    };
    navigate(loginRoutes[role] || '/login');
  };

  return (
    <div className="min-h-screen bg-navy">
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-16 px-4 bg-navy-light border-b border-navy-border">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-white"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-gold text-sm sm:text-base truncate px-2">{portalName}</span>
        <Bell className="w-5 h-5 text-gray-400 shrink-0" />
      </div>

      <div className="flex min-h-[calc(100dvh-4rem)] lg:min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 max-w-[min(18rem,85vw)] bg-navy-light border-r border-navy-border',
            'flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:max-w-none lg:w-64 lg:shrink-0 lg:min-h-screen lg:sticky lg:top-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-navy-border shrink-0">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">
                Data<span className="text-gold">Bundle</span>
              </h1>
              <p className="text-xs text-gray-400 truncate">{portalName}</p>
            </div>
            <button
              type="button"
              className="lg:hidden text-gray-400 p-1 shrink-0"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                    active
                      ? 'bg-gold/15 text-gold border border-gold/20'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 p-3 sm:p-4 border-t border-navy-border safe-bottom">
            <a
              href="tel:+233595399837"
              className="flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-lg bg-navy/60 border border-navy-border hover:border-gold/30 transition"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gold/15 text-gold shrink-0">
                <Phone className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500">Support</span>
                <span className="block text-xs font-semibold text-white truncate">+233 59 539 9837</span>
              </span>
            </a>
            <div className="px-3 py-2 mb-2 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              Logout
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 w-full p-4 sm:p-6 lg:p-8 pb-6 text-white overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
