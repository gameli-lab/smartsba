"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface MonthlyCount {
  month: string;
  count: number;
}

export default function SchoolsCountChart() {
  const [data, setData] = useState<MonthlyCount[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/analytics/schools/count', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || 'Failed to load analytics');
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (!mounted) return;
        setData(json.monthlyCounts || []);
        setTotal(json.totalSchools ?? null);
      } catch (e: unknown) {
        console.error('Error fetching analytics:', e);
        setError('Failed to fetch analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading analytics…</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Schools — Last 12 months</h3>
      {total !== null && <p className="text-sm text-muted-foreground">Total schools: {total}</p>}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
