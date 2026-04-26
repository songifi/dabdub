'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';
import { waitlistApi } from '@/lib/api';

export default function WaitlistPage() {
  const [form, setForm] = useState({ email: '', username: '', businessName: '', country: '' });
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await waitlistApi.join(form);
      setJoined(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to join waitlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Link href="/" className="font-bold text-xl text-brand-600">CheesePay</Link>
          <h2 className="text-2xl font-bold mt-4 mb-2">Join the waitlist</h2>
          <p className="text-gray-500 text-sm">Be first to access CheesePay when we launch</p>
        </div>

        {joined ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg">You&apos;re on the list!</h3>
            <p className="text-gray-500 text-sm mt-2">We&apos;ll reach out when your account is ready.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {[
              { key: 'email', label: 'Email', type: 'email', required: true },
              { key: 'username', label: 'Username (optional)', type: 'text', required: false },
              { key: 'businessName', label: 'Business Name (optional)', type: 'text', required: false },
              { key: 'country', label: 'Country (optional)', type: 'text', required: false },
            ].map(({ key, label, type, required }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Joining...' : 'Join waitlist'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
