'use client';

import { useEffect, useState } from 'react';
import { settlementsApi } from '@/lib/api';
import { formatUsd, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    settlementsApi.list(page, 20).then(({ data }) => {
      setSettlements(data.settlements);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
        <p className="text-sm text-gray-500 mt-1">{total} total settlements</p>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Gross</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Net</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : settlements.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No settlements yet</td></tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{s.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4">{formatUsd(s.totalAmountUsd)}</td>
                    <td className="px-6 py-4 text-red-600">-{formatUsd(s.feeAmountUsd)}</td>
                    <td className="px-6 py-4 font-semibold text-green-700">{formatUsd(s.netAmountUsd)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(s.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm px-3 py-1">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary text-sm px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
