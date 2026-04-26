'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { webhooksApi } from '@/lib/api';
import { WEBHOOK_EVENTS, formatDate } from '@/lib/utils';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] as string[] });
  const [creating, setCreating] = useState(false);

  const load = () => webhooksApi.list().then(({ data }) => setWebhooks(data));

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.events.length === 0) return toast.error('Select at least one event');
    setCreating(true);
    try {
      await webhooksApi.create(form);
      toast.success('Webhook created');
      setShowCreate(false);
      setForm({ url: '', events: [] });
      load();
    } catch {
      toast.error('Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    await webhooksApi.remove(id);
    toast.success('Webhook removed');
    load();
  };

  const toggleEvent = (e: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Get notified when payment events occur</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">New Webhook</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label">Endpoint URL</label>
                <input className="input" type="url" required placeholder="https://your-server.com/webhook"
                  value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div>
                <label className="label">Events</label>
                <div className="space-y-2 mt-1">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <label key={evt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.events.includes(evt)} onChange={() => toggleEvent(evt)} />
                      <code className="text-xs">{evt}</code>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full">
                {creating ? 'Creating...' : 'Create Webhook'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">No webhooks configured</div>
        ) : (
          webhooks.map((w) => (
            <div key={w.id} className="card p-5 flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-medium break-all">{w.url}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {w.events.map((e: string) => (
                    <span key={e} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{e}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Created {formatDate(w.createdAt)}</p>
              </div>
              <button onClick={() => remove(w.id)} className="text-red-400 hover:text-red-600 ml-4">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
