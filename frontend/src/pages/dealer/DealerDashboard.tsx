import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { Wallet, ShoppingCart, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DealerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && (!user || user.role !== 'dealer')) navigate('/login/dealer');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user?.role === 'dealer') {
      api.get('/dealer/dashboard').then((res) => setStats(res.data.data));
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <DashboardLayout role="dealer">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Dealer Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Wallet Balance" value={formatCurrency(stats.walletBalance || 0)} icon={<Wallet className="w-5 h-5" />} color="blue" />
        <StatCard title="Orders Today" value={stats.ordersToday || 0} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Orders This Week" value={stats.ordersThisWeek || 0} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Orders This Month" value={stats.ordersThisMonth || 0} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Total Purchases" value={formatCurrency(stats.totalPurchases || 0)} icon={<DollarSign className="w-5 h-5" />} color="orange" />
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} icon={<DollarSign className="w-5 h-5" />} color="green" />
      </div>
    </DashboardLayout>
  );
}
