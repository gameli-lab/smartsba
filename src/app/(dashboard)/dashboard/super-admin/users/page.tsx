"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import EditSuperAdminModal from '@/components/super-admin/EditSuperAdminModal';
import type { UserProfile } from '@/types';

interface Row {
	id: string;
	user_id?: string | null;
	full_name?: string | null;
	email?: string | null;
	role?: string | null;
	school?: string | null;
}

export default function UsersPage() {
	const [users, setUsers] = useState<Row[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [cursorStack, setCursorStack] = useState<string[]>([]); // stack for prev cursors
	const [perPage] = useState(10);
	const [q, setQ] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<UserProfile | null>(null);

	const fetchUsers = async (opts?: { cursor?: string | null, reset?: boolean }) => {
		setLoading(true);
		setError(null);
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData?.session?.access_token;
			if (!token) throw new Error('Not authenticated');

			const url = new URL('/api/super-admin', window.location.origin);
			url.searchParams.set('per_page', String(perPage));
			if (q.trim()) url.searchParams.set('q', q.trim());
			const useCursor = opts?.cursor ?? null;
			if (opts?.reset) {
				url.searchParams.delete('cursor');
			} else if (useCursor) {
				url.searchParams.set('cursor', useCursor);
			}

			const res = await fetch(url.toString(), {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to fetch users');
			}

			const json = await res.json();
			setUsers((json.users as Row[]) || []);
			setNextCursor(json.next_cursor || null);
		} catch (e: unknown) {
			console.error('Error fetching users:', e);
			setError(((e as Error)?.message) ?? 'Error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUsers({ cursor: cursorStack.length ? cursorStack[cursorStack.length - 1] : null });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cursorStack]);

	const handleDelete = async (id: string) => {
		if (!confirm('Delete this user? This action cannot be undone.')) return;
		setLoading(true);
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			const token = sessionData?.session?.access_token;
			if (!token) throw new Error('Not authenticated');

			const res = await fetch(`/api/super-admin/${id}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to delete');
			}

			await fetchUsers();
		} catch (e: unknown) {
			console.error('Error deleting user:', e);
			setError(((e as Error)?.message) ?? 'Error');
		} finally {
			setLoading(false);
		}
	};

	const openEdit = (r: Row) => {
		// Build a minimal UserProfile to pass into the existing modal
		const profile = {
			id: r.id,
			user_id: r.user_id || '',
			school_id: '',
			role: (r.role as UserProfile['role']) || 'super_admin',
			email: r.email || '',
			full_name: r.full_name || '',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		} as UserProfile;
		setEditing(profile);
	};

	return (
		<div className="p-6">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-semibold">Users</h1>
				<div className="flex items-center gap-2">
					<input
						className="input"
						placeholder="Search by name or email"
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
					  <button className="btn" onClick={() => { setCursorStack([]); fetchUsers({ reset: true }); }} disabled={loading}>Search</button>
					  <button className="btn" onClick={() => { setQ(''); setCursorStack([]); fetchUsers({ reset: true }); }} disabled={loading}>Clear</button>
				</div>
			</div>

			{loading && <div>Loading…</div>}
			{error && <div className="text-red-600 mb-2">{error}</div>}

			{!loading && users.length === 0 && <div>No users found.</div>}

			{!loading && users.length > 0 && (
				<div className="overflow-x-auto">
					<table className="min-w-full table-auto border-collapse">
						<thead>
							<tr className="text-left">
								<th className="px-3 py-2">Name</th>
								<th className="px-3 py-2">Email</th>
								<th className="px-3 py-2">Role</th>
								<th className="px-3 py-2">School</th>
								<th className="px-3 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<tr key={u.id} className="border-t">
									<td className="px-3 py-2">{u.full_name}</td>
									<td className="px-3 py-2">{u.email}</td>
									<td className="px-3 py-2">{u.role || ''}</td>
									<td className="px-3 py-2">{u.school || ''}</td>
									<td className="px-3 py-2">
										<button className="btn btn-sm mr-2" onClick={() => openEdit(u)}>Edit</button>
										<button className="btn btn-sm btn-ghost" onClick={() => handleDelete(u.id)}>Delete</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="flex items-center justify-between mt-4">
				<div />
				<div className="flex items-center gap-2">
					<button
						className="btn"
						onClick={() => {
							// go back
							setCursorStack((s) => {
								if (s.length === 0) return s;
								const next = [...s];
								next.pop();
								return next;
							});
						}}
						disabled={cursorStack.length === 0 || loading}
					>Prev</button>
					<button
						className="btn"
						onClick={() => {
							if (!nextCursor) return;
							// push current cursor and navigate to next
							setCursorStack((s) => [...s, nextCursor]);
						}}
						disabled={!nextCursor || loading}
					>Next</button>
				</div>
			</div>

			{editing && (
				<EditSuperAdminModal
					admin={editing}
					onClose={() => setEditing(null)}
					onSaved={() => { setEditing(null); fetchUsers(); }}
				/>
			)}
		</div>
	);
}

