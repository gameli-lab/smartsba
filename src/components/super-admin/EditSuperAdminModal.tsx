"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

interface Props {
  admin: UserProfile;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditSuperAdminModal({ admin, onClose, onSaved }: Props) {
  const [fullName, setFullName] = useState(admin.full_name || '');
  const [email, setEmail] = useState(admin.email || '');
  const [status, setStatus] = useState(admin.status || 'active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/super-admin/${admin.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: fullName, email, status }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update');
      }

      onSaved();
    } catch (e: unknown) {
      console.error('Error updating sysadmin:', e);
      setError(((e as Error)?.message) ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md p-6 w-full max-w-md">
        <h2 className="text-lg font-medium mb-4">Edit SysAdmin</h2>

        {error && <div className="text-red-600 mb-2">{error}</div>}

        <label className="block mb-2">
          <div className="text-sm">Full name</div>
          <input className="input w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>

        <label className="block mb-2">
          <div className="text-sm">Email</div>
          <input className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="block mb-4">
          <div className="text-sm">Status</div>
          <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
