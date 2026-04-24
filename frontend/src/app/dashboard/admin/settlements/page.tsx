'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Filter,
  ExternalLink 
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

interface Settlement {
  id: string;
  merchantId: string;
  merchant: {
    businessName: string;
  };
  totalAmountUsd: number;
  feeAmountUsd: number;
  netAmountUsd: number;
  fiatCurrency: string;
  fiatAmount: number;
  status: 'pending' | 'pending_approval' | 'processing' | 'completed' | 'failed';
  partnerReference: string;
  bankReference: string;
  failureReason: string;
  requiresApproval: boolean;
  approvedBy: string;
  approvedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SettlementsResponse {
  data: Settlement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const statusIcons = {
  pending: Clock,
  pending_approval: AlertCircle,
  processing: RefreshCw,
  completed: CheckCircle,
  failed: AlertCircle,
};

export default function AdminSettlementsPage() {
  const { token } = useAuthStore();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    merchantId: '',
    startDate: '',
    endDate: '',
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      });

      const response = await api.get<SettlementsResponse>(
        `/api/v1/admin/settlements?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSettlements(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchSettlements();
  }, [token, page, filters]);

  const handleRetry = async (settlementId: string) => {
    try {
      setActionLoading(settlementId);
      await api.post(
        `/api/v1/admin/settlements/${settlementId}/retry`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchSettlements();
    } catch (error) {
      console.error('Failed to retry settlement:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (settlementId: string) => {
    try {
      setActionLoading(settlementId);
      await api.post(
        `/api/v1/admin/settlements/${settlementId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchSettlements();
    } catch (error) {
      console.error('Failed to approve settlement:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settlements</h1>
        <p className="text-gray-600">Manage and monitor all merchant settlements</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="text"
            placeholder="Merchant ID"
            value={filters.merchantId}
            onChange={(e) => setFilters({ ...filters, merchantId: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          />

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          />

          <button
            onClick={() => setFilters({ status: '', merchantId: '', startDate: '', endDate: '' })}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Settlement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner Ref</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading settlements...
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No settlements found
                  </td>
                </tr>
              ) : (
                settlements.map((settlement) => {
                  const StatusIcon = statusIcons[settlement.status];
                  return (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {settlement.id.slice(0, 8)}...
                        </div>
                        {settlement.failureReason && (
                          <div className="text-xs text-red-600 mt-1">
                            {settlement.failureReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {settlement.merchant?.businessName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {settlement.merchantId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(settlement.netAmountUsd)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Fee: {formatCurrency(settlement.feeAmountUsd)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[settlement.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {settlement.status.replace('_', ' ')}
                        </span>
                        {settlement.requiresApproval && (
                          <div className="text-xs text-orange-600 mt-1">
                            Requires approval
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {settlement.partnerReference ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-900">
                              {settlement.partnerReference}
                            </span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(settlement.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {settlement.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(settlement.id)}
                              disabled={actionLoading === settlement.id}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              {actionLoading === settlement.id ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                          {settlement.status === 'pending_approval' && (
                            <button
                              onClick={() => handleApprove(settlement.id)}
                              disabled={actionLoading === settlement.id}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                            >
                              {actionLoading === settlement.id ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} settlements
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}