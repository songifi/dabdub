'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { merchantApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const { merchant } = useAuthStore();
  const [form, setForm] = useState({ businessName: '', country: '', bankAccountNumber: '', bankCode: '', bankName: '' });
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    merchantApi.profile().then(({ data }) => {
      setForm({
        businessName: data.businessName ?? '',
        country: data.country ?? '',
        bankAccountNumber: data.bankAccountNumber ?? '',
        bankCode: data.bankCode ?? '',
        bankName: data.bankName ?? '',
      });
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await merchantApi.update(form);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const generateKey = async () => {
    setGeneratingKey(true);
    try {
      const { data } = await merchantApi.generateApiKey();
      setApiKey(data.apiKey);
      toast.success('API key generated — save it now, it won\'t be shown again');
    } catch {
      toast.error('Failed to generate API key');
    } finally {
      setGeneratingKey(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Business Profile</h2>
        <form onSubmit={save} className="space-y-4">
          {[
            { key: 'businessName', label: 'Business Name' },
            { key: 'country', label: 'Country' },
            { key: 'bankName', label: 'Bank Name' },
            { key: 'bankCode', label: 'Bank Code' },
            { key: 'bankAccountNumber', label: 'Bank Account Number' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-2">API Key</h2>
        <p className="text-sm text-gray-500 mb-4">Use your API key to authenticate server-side API requests.</p>
        {apiKey ? (
          <div className="bg-gray-900 text-green-400 font-mono text-sm p-3 rounded-lg break-all mb-3">
            {apiKey}
          </div>
        ) : null}
        <button onClick={generateKey} disabled={generatingKey} className="btn-secondary">
          {generatingKey ? 'Generating...' : 'Generate new API key'}
        </button>
        <p className="text-xs text-red-500 mt-2">Generating a new key will invalidate the previous one.</p>
      </div>
    </div>
  );
}
