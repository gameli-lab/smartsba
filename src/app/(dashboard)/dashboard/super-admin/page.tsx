"use client";

import React, { useState, useEffect } from 'react';
import SuperAdminTable from '@/components/super-admin/SuperAdminTable';
import EditSuperAdminModal from '@/components/super-admin/EditSuperAdminModal';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

export default function SuperAdminPage() {
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserProfile | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/super-admin', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch super admins');
      }

      const json = await res.json();
      setAdmins((json.superAdmins as UserProfile[]) || []);
    } catch (e: unknown) {
      console.error('Error fetching super admins:', e);
      setError(((e as Error)?.message) ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Super Admin</h1>
        <div>
          <button className="btn" onClick={fetchAdmins} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <SuperAdminTable
          admins={admins}
          onEdit={(admin) => setEditing(admin)}
        />
      )}

      {editing && (
        <EditSuperAdminModal
          admin={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchAdmins();
          }}
        />
      )}
    </div>
  );
}
