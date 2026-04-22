'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { paymentsApi } from '@/lib/api';
import { formatUsd, formatDate, PAYMENT_STATUS_COLORS } from '@/lib/utils';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [form, setForm] = useState({ amountUsd: '', description: '', customerEmail: '', expiryMinutes: '30' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await paymentsApi.list(p, 20);
      setPayments(data.payments);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [page]);

  const createPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await paymentsApi.create({
        amountUsd: parseFloat(form.amountUsd),
        description: form.description || undefined,
        customerEmail: form.customerEmail || undefined,
        expiryMinutes: parseInt(form.expiryMinutes),
      });
      setSelectedPayment(data);
      setShowCreate(false);
      setForm({ amountUsd: '', description: '', customerEmail: '', expiryMinutes: '30' });
      load(1);
      toast.success('Payment created');
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create payment');
    } finally {
      setCreating(false);
    }
  };

  const copyMemo = (memo: string) => {
    navigator.clipboard.writeText(memo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total payments</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Payment
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg">Create Payment</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createPayment} className="space-y-4">
              <div>
                <label className="label">Amount (USD)</label>
                <input className="input" type="number" step="0.01" min="0.01" required value={form.amountUsd}
                  onChange={(e) => setForm({ ...form, amountUsd: e.target.value })} />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input className="input" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Customer Email (optional)</label>
                <input className="input" type="email" value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
              </div>
              <div>
                <label className="label">Expires in (minutes)</label>
                <input className="input" type="number" min="5" max="1440" value={form.expiryMinutes}
                  onChange={(e) => setForm({ ...form, expiryMinutes: e.target.value })} />
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full">
                {creating ? 'Creating...' : 'Create Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Payment QR Code</h2>
              <button onClick={() => setSelectedPayment(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              <QRCodeSVG value={selectedPayment.qrCode ?? selectedPayment.stellarDepositAddress} size={200} />
            </div>
            <p className="text-sm font-semibold mb-1">{formatUsd(selectedPayment.amountUsd)}</p>
            <p className="text-xs text-gray-500 mb-3">{selectedPayment.reference}</p>
            <div className="bg-gray-50 rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500 mb-1">Stellar Memo (required)</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold flex-1">{selectedPayment.stellarMemo}</code>
                <button onClick={() => copyMemo(selectedPayment.stellarMemo)}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Send to: {selectedPayment.stellarDepositAddress?.slice(0, 8)}...{selectedPayment.stellarDepositAddress?.slice(-6)}</p>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No payments yet</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs">{p.reference}</td>
                    <td className="px-6 py-4 font-semibold">{formatUsd(p.amountUsd)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(p.createdAt)}</td>
                    <td className="px-6 py-4">
                      {p.status === 'pending' && (
                        <button onClick={() => setSelectedPayment(p)} className="text-brand-600 text-xs hover:underline">
                          Show QR
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
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
