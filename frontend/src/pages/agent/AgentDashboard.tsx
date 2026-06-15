import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';

import { api } from '@/lib/api';

import DashboardLayout from '@/components/layout/DashboardLayout';

import { StatCard } from '@/components/ui/Card';

import { formatCurrency } from '@/lib/utils';

import {

  Wallet,

  ShoppingCart,

  DollarSign,

  Clock,

  Settings,

  CheckCircle,

  XCircle,

  Calendar,

  ClipboardList,

  Trophy,

} from 'lucide-react';

import { Link, useNavigate } from 'react-router-dom';
import DashboardInsights from '@/components/dashboard/DashboardInsights';
import { GrowthPoint } from '@/components/dashboard/GrowthAreaChart';

export default function AgentDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [growthChart, setGrowthChart] = useState<GrowthPoint[]>([]);



  useEffect(() => {

    if (!loading && (!user || user.role !== 'agent')) navigate('/login/agent');

  }, [user, loading, navigate]);



  const loadStats = useCallback(async () => {

    const res = await api.get('/agent/dashboard');
    const data = res.data.data;
    setStats(data);
    setGrowthChart(data.growthChart || []);

  }, []);



  useEffect(() => {

    if (user?.role === 'agent') loadStats();

  }, [user, loadStats]);



  useEffect(() => {

    if (user?.role !== 'agent') return;

    const interval = setInterval(loadStats, 30000);

    return () => clearInterval(interval);

  }, [user, loadStats]);



  if (loading || !user) return null;



  return (

    <DashboardLayout role="agent">

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Agent Dashboard</h1>

      <p className="text-sm text-gray-400 mb-6">Wallet, purchases, and order delivery status</p>

      <DashboardInsights
        growthChart={growthChart}
        stats={stats}
        chartTitle="Purchase Growth"
        chartSubtitle="Last 14 days — orders and spend"
        amountLabel="Spend"
        ordersLink="/agent/orders"
        accent="blue"
      />

      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

        {user.performance?.rankLabel && (
          <StatCard
            title="Your Rank"
            value={user.performance.rankLabel}
            subtitle={`${user.performance.orderCount} delivered orders this month`}
            icon={<Trophy className="w-5 h-5" />}
            color="gold"
          />
        )}

        <StatCard

          title="Wallet Balance"

          value={formatCurrency(stats.walletBalance || 0)}

          subtitle="available"

          icon={<Wallet className="w-5 h-5" />}

          color="blue"

        />

        <StatCard

          title="Total Purchases"

          value={formatCurrency(stats.totalPurchases || 0)}

          subtitle="all time"

          icon={<DollarSign className="w-5 h-5" />}

          color="orange"

        />

        <StatCard

          title="Total Revenue"

          value={formatCurrency(stats.totalRevenue || 0)}

          subtitle="delivered orders"

          icon={<DollarSign className="w-5 h-5" />}

          color="green"

        />

      </div>



      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Order activity</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

        <StatCard

          title="Orders Today"

          value={stats.ordersToday || 0}

          subtitle="orders"

          icon={<Calendar className="w-5 h-5" />}

          color="blue"

        />

        <StatCard

          title="Orders This Week"

          value={stats.ordersThisWeek || 0}

          subtitle="orders"

          icon={<ClipboardList className="w-5 h-5" />}

          color="slate"

        />

        <StatCard

          title="Orders This Month"

          value={stats.ordersThisMonth || 0}

          subtitle="orders"

          icon={<ShoppingCart className="w-5 h-5" />}

          color="cyan"

        />

      </div>



      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">Delivery status</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <Link to="/agent/orders" className="block">

          <StatCard

            title="Pending"

            value={stats.pendingOrders || 0}

            subtitle="awaiting action"

            icon={<Clock className="w-5 h-5" />}

            color="amber"

          />

        </Link>

        <Link to="/agent/orders" className="block">

          <StatCard

            title="Processing"

            value={stats.processingOrders || 0}

            subtitle="in progress"

            icon={<Settings className="w-5 h-5" />}

            color="sky"

          />

        </Link>

        <Link to="/agent/orders" className="block">

          <StatCard

            title="Delivered"

            value={stats.deliveredOrders || 0}

            subtitle="completed"

            icon={<CheckCircle className="w-5 h-5" />}

            color="emerald"

          />

        </Link>

        <Link to="/agent/orders" className="block">

          <StatCard

            title="Not Delivered"

            value={stats.notDeliveredOrders || 0}

            subtitle="failed or cancelled"

            icon={<XCircle className="w-5 h-5" />}

            color="rose"

          />

        </Link>

      </div>

    </DashboardLayout>

  );

}


