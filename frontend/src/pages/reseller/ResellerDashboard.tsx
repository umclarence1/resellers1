import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';

import { api } from '@/lib/api';

import DashboardLayout from '@/components/layout/DashboardLayout';

import { StatCard, Card } from '@/components/ui/Card';

import Button from '@/components/ui/Button';

import { formatCurrency } from '@/lib/utils';

import {
  Wallet,
  DollarSign,
  ExternalLink,
  Calendar,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

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

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Reseller Dashboard</h1>

      <p className="text-sm text-gray-400 mb-6">Your store performance at a glance</p>



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



      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Order activity</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <StatCard title="Orders Today" value={Number(stats.ordersToday) || 0} subtitle="orders" icon={<Calendar />} color="blue" />

        <StatCard title="Orders This Week" value={Number(stats.ordersThisWeek) || 0} subtitle="orders" icon={<ClipboardList />} color="slate" />

        <StatCard title="Orders This Month" value={Number(stats.ordersThisMonth) || 0} subtitle="orders" icon={<ClipboardList />} color="cyan" />

        <StatCard title="Pending Orders" value={Number(stats.pendingOrders) || 0} subtitle="orders" icon={<Clock />} color="amber" />

      </div>



      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">

        <StatCard title="Successful" value={Number(stats.successfulOrders) || 0} subtitle="delivered" icon={<CheckCircle />} color="emerald" />

        <StatCard title="Failed" value={Number(stats.failedOrders) || 0} subtitle="orders" icon={<AlertCircle />} color="rose" />

        <StatCard title="Total Revenue" value={formatCurrency(Number(stats.totalRevenue) || 0)} subtitle="all time" icon={<DollarSign />} color="gold" />

        <StatCard title="Total Profit" value={formatCurrency(Number(stats.totalProfit) || 0)} subtitle="earned" icon={<TrendingUp />} color="green" />

      </div>



      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Wallet &amp; earnings</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard title="Wallet Balance" value={formatCurrency(Number(stats.walletBalance) || 0)} subtitle="account" icon={<Wallet />} color="blue" />

        <Link to="/reseller/withdrawals" className="block">

          <StatCard title="Withdrawable" value={formatCurrency(Number(stats.withdrawableProfit) || 0)} subtitle="profit" icon={<Wallet />} color="purple" />

        </Link>

        <StatCard title="Profit Today" value={formatCurrency(Number(stats.profitToday) || 0)} subtitle="earned" icon={<DollarSign />} color="sky" />

        <StatCard title="Profit This Month" value={formatCurrency(Number(stats.profitThisMonth) || 0)} subtitle="earned" icon={<DollarSign />} color="emerald" />

      </div>

    </DashboardLayout>

  );

}

