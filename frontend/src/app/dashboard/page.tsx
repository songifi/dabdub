'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, CreditCard, Banknote, Clock } from 'lucide-react';
import { paymentsApi, settlementsApi } from '@/lib/api';
import { formatUsd, formatDate, PAYMENT_STATUS_COLORS } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const { merchant } = useAuthStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([paymentsApi.list(1, 5), paymentsApi.stats()])
      .then(([p, s]) => {
        setPayments(p.data.payments);
        setStats(s.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const statMap = stats.reduce((acc: any, s: any) => {
    acc[s.status] = { count: parseInt(s.count), total: parseFloat(s.totalUsd ?? 0) };
    return acc;
  }, {});

  const totalVolume = stats.reduce((acc: any, s: any) => acc + parseFloat(s.totalUsd ?? 0), 0);
  const settledCount = statMap.settled?.count ?? 0;
  const pendingCount = statMap.pending?.count ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {merchant?.businessName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your payments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Volume', value: formatUsd(totalVolume), icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Settled Payments', value: settledCount, icon: Banknote, color: 'text-green-600' },
          { label: 'Pending Payments', value: pendingCount, icon: Clock, color: 'text-yellow-600' },
          { label: 'Total Payments', value: stats.reduce((a, s) => a + parseInt(s.count), 0), icon: CreditCard, color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</div>
          </div>
        ))}
      </div>

      {/* Recent payments */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Payments</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">No payments yet</div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.reference}</p>
                  <p className="text-xs text-gray-400">{formatDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[p.status]}`}>
                    {p.status}
                  </span>
                  <span className="text-sm font-semibold">{formatUsd(p.amountUsd)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
