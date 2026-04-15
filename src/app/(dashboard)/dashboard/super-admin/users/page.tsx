"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getClientCsrfHeaders } from '@/lib/csrf';
import EditSuperAdminModal from '@/components/super-admin/EditSuperAdminModal';
import type { UserProfile } from '@/types';
import { BulkOperationDialog } from '@/components/super-admin/BulkOperationDialog';
import { bulkDeleteUsers } from '../bulk-operations/actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square } from 'lucide-react';
import { ExportButton } from '@/components/super-admin/ExportButton';
import { exportUsersToCSV } from '../exports/actions';
import { exportUsersToPDF } from '@/lib/pdf-export';

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
	const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
	const [bulkOperation, setBulkOperation] = useState<'delete' | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [userRole, setUserRole] = useState<string | null>(null);

	// Get current user session
	useEffect(() => {
		async function getUser() {
			const { data: { session } } = await supabase.auth.getSession();
			if (session) {
				setUserId(session.user.id);
				const profileResponse = (await supabase
					.from('user_profiles')
					.select('role')
					.eq('user_id', session.user.id)
					.single()) as { data: { role: string } | null };
				if (profileResponse.data) {
					setUserRole(profileResponse.data.role);
				}
			}
		}
		getUser();
	}, []);

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
				headers: getClientCsrfHeaders({ Authorization: `Bearer ${token}` }),
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

	const toggleUserSelection = (userId: string) => {
		const newSet = new Set(selectedUserIds);
		if (newSet.has(userId)) {
			newSet.delete(userId);
		} else {
			newSet.add(userId);
		}
		setSelectedUserIds(newSet);
	};

	const toggleSelectAll = () => {
		if (selectedUserIds.size === users.length) {
			setSelectedUserIds(new Set());
		} else {
			setSelectedUserIds(new Set(users.map((u) => u.id)));
		}
	};

	const clearSelection = () => {
		setSelectedUserIds(new Set());
	};

	const handleBulkOperation = async () => {
		if (!bulkOperation || !userId || !userRole) return { success: false, message: 'Not authenticated', successCount: 0, failureCount: selectedUserIds.size };

		const ids = Array.from(selectedUserIds);
		const result = await bulkDeleteUsers(ids, userId, userRole);

		// Refresh users list after bulk operation
		await fetchUsers();
		clearSelection();

		return result;
	};

	const getSelectedUsersInfo = () => {
		return users
			.filter((u) => selectedUserIds.has(u.id))
			.map((u) => ({ id: u.id, name: u.full_name || u.email || 'Unknown' }));
	};

	const handleExportCSV = async () => {
		if (!userId || !userRole) {
			alert('Not authenticated');
			return;
		}

		const result = await exportUsersToCSV(userId, userRole, {
			search: q,
		});

		if (result.success && result.data && result.filename) {
			const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', result.filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} else {
			alert(result.error || 'Export failed');
		}
	};

	const handleExportPDF = async () => {
		const result = await exportUsersToPDF(users, { search: q });

		if (!result.success) {
			alert(result.error || 'Export failed');
		}
	};

	return (
		<div className="overflow-x-clip p-3 sm:p-4 lg:p-6">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-semibold">Users</h1>
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
					<ExportButton
						onExportCSV={handleExportCSV}
						onExportPDF={handleExportPDF}
						disabled={loading}
					/>
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

			{/* Bulk Actions Toolbar */}
			{selectedUserIds.size > 0 && (
				<div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted p-4">
					<Badge variant="secondary" className="text-sm">
						{selectedUserIds.size} selected
					</Badge>
					<Button
						size="sm"
						variant="destructive"
						onClick={() => setBulkOperation('delete')}
					>
						Delete Selected
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={clearSelection}
					>
						Clear Selection
					</Button>
				</div>
			)}

			{loading && <div>Loading…</div>}
			{error && <div className="text-red-600 mb-2">{error}</div>}

			{!loading && users.length === 0 && <div>No users found.</div>}

			{/* Select All */}
			{!loading && users.length > 0 && (
				<div className="mb-2">
					<Button
						variant="outline"
						size="sm"
						onClick={toggleSelectAll}
						className="gap-2"
					>
						{selectedUserIds.size === users.length ? (
							<CheckSquare className="h-4 w-4" />
						) : (
							<Square className="h-4 w-4" />
						)}
						{selectedUserIds.size === users.length ? 'Deselect All' : 'Select All'}
					</Button>
				</div>
			)}

			{!loading && users.length > 0 && (
				<div className="overflow-x-auto">
					<table className="min-w-full table-auto border-collapse">
						<thead>
							<tr className="text-left">
								<th className="px-3 py-2 w-12"></th>
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
									<td className="px-3 py-2">
										<Checkbox
											checked={selectedUserIds.has(u.id)}
											onCheckedChange={() => toggleUserSelection(u.id)}
										/>
									</td>
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

			<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

			{/* Bulk Operation Dialog */}
			{bulkOperation && (
				<BulkOperationDialog
					open={bulkOperation !== null}
					onOpenChange={(open) => !open && setBulkOperation(null)}
					operation={bulkOperation}
					entityType="user"
					selectedCount={selectedUserIds.size}
					selectedItems={getSelectedUsersInfo()}
					onConfirm={handleBulkOperation}
				/>
			)}
		</div>
	);
}

