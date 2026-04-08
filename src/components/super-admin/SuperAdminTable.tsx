"use client";

import React from 'react';
import type { UserProfile } from '@/types';

interface Props {
  admins: UserProfile[];
  onEdit: (admin: UserProfile) => void;
}

export default function SuperAdminTable({ admins, onEdit }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="text-left">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2">{a.full_name}</td>
              <td className="px-3 py-2">{a.email}</td>
              <td className="px-3 py-2">{a.status || 'active'}</td>
              <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">
                <button className="btn btn-sm mr-2" onClick={() => onEdit(a)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
