import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard, Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Wallet, ShoppingCart, DollarSign, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ResellerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (!loading && (!user || user.role !== 'reseller')) navigate('/login/reseller');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'reseller') {
      api.get('/reseller/dashboard').then((res) => setStats(res.data.data));
    }
  }, [user]);

  if (loading || !user) return null;

  const storeUrl = user.resellerStore?.slug
    ? `${window.location.origin}/store/${user.resellerStore.slug}`
    : null;

  return (
    <DashboardLayout role="reseller">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Reseller Dashboard</h1>

      {storeUrl && (
        <Card className="p-4 border-amber-200/60 bg-gradient-to-r from-amber-50/90 to-white mb-8 max-w-xl">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold mb-1">Store link</p>
          <p className="font-mono text-sm text-gray-800 truncate mb-3">{storeUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(storeUrl)}>Copy</Button>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary"><ExternalLink className="w-4 h-4" /></Button>
            </a>
            <Link to="/reseller/store"><Button size="sm">Edit store</Button></Link>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="Wallet Balance" value={formatCurrency(Number(stats.walletBalance) || 0)} icon={<Wallet className="w-5 h-5" />} color="blue" />
        <StatCard title="Orders Today" value={Number(stats.ordersToday) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="gold" />
        <StatCard title="Orders This Week" value={Number(stats.ordersThisWeek) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="cyan" />
        <StatCard title="Orders This Month" value={Number(stats.ordersThisMonth) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="purple" />
        <StatCard title="Successful Orders" value={Number(stats.successfulOrders) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="green" />
        <StatCard title="Failed Orders" value={Number(stats.failedOrders) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="red" />
        <StatCard title="Pending Orders" value={Number(stats.pendingOrders) || 0} icon={<ShoppingCart className="w-5 h-5" />} color="orange" />
        <StatCard title="Total Revenue" value={formatCurrency(Number(stats.totalRevenue) || 0)} icon={<DollarSign className="w-5 h-5" />} color="green" />
        <StatCard title="Total Profit" value={formatCurrency(Number(stats.totalProfit) || 0)} icon={<DollarSign className="w-5 h-5" />} color="blue" />
        <Link to="/reseller/withdrawals" className="block">
          <StatCard title="Withdrawable Profit" value={formatCurrency(Number(stats.withdrawableProfit) || 0)} icon={<Wallet className="w-5 h-5" />} color="purple" />
        </Link>
      </div>
    </DashboardLayout>
  );
}
