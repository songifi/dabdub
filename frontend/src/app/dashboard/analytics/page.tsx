'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { paymentsApi } from '@/lib/api';
import { formatUsd } from '@/lib/utils';

const COLORS = ['#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#6b7280'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsApi.stats().then(({ data }) => setStats(data)).finally(() => setLoading(false));
  }, []);

  const pieData = stats.map((s) => ({
    name: s.status,
    value: parseInt(s.count),
    amount: parseFloat(s.totalUsd ?? 0),
  }));

  const totalVolume = stats.reduce((acc, s) => acc + parseFloat(s.totalUsd ?? 0), 0);
  const totalCount = stats.reduce((acc, s) => acc + parseInt(s.count), 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Payment volume and status breakdown</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-6">
              <p className="text-sm text-gray-500 mb-1">Total Volume</p>
              <p className="text-3xl font-bold">{formatUsd(totalVolume)}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold">{totalCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Payment Count by Status</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-6">
              <h2 className="font-semibold mb-4">Volume by Status (USD)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pieData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatUsd(v)} />
                  <Bar dataKey="amount" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
