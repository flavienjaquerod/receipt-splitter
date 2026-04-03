'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/authContext';
import { useDarkMode } from '../../contexts/darkModeContext';
import { CATEGORIES } from '../../lib/categories';
import DarkModeToggle from '../../components/darkModeToggle';
import { FileText, Plus, LogOut, TrendingUp, ShoppingBag, Calendar } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount) {
  return `CHF ${amount.toFixed(2)}`;
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut, loading } = useAuth();
  const { isDarkMode } = useDarkMode();
  const router = useRouter();

  const [receipts, setReceipts] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    Promise.all([
      supabase.from('receipts').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*, receipts(created_at)').order('created_at', { ascending: false }),
    ]).then(([{ data: r }, { data: i }]) => {
      setReceipts(r || []);
      setItems(i || []);
      setLoadingData(false);
    });
  }, [user]);

  if (loading || !user) return null;

  // ── Analytics ─────────────────────────────────────────────────────────────

  const totalSpent = items.reduce((s, i) => s + Number(i.current_price), 0);
  const totalReceipts = receipts.length;

  // Spending by category
  const byCategory = Object.entries(
    items.reduce((acc, item) => {
      const key = item.category || 'other';
      acc[key] = (acc[key] || 0) + Number(item.current_price);
      return acc;
    }, {})
  )
    .map(([key, total]) => ({
      key,
      label: CATEGORIES[key]?.label ?? 'Other',
      total,
      color: isDarkMode ? (CATEGORIES[key]?.dark ?? '#9CA3AF') : (CATEGORIES[key]?.light ?? '#6B7280'),
    }))
    .sort((a, b) => b.total - a.total);

  // Spending by month
  const byMonth = Object.entries(
    items.reduce((acc, item) => {
      const date = item.receipts?.created_at;
      if (!date) return acc;
      const key = monthKey(date);
      acc[key] = (acc[key] || 0) + Number(item.current_price);
      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, total]) => ({ month: monthLabel(key), total }));

  const axisColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const gridColor = isDarkMode ? '#374151' : '#E5E7EB';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1F2937' : '#fff',
    border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
    borderRadius: 8,
    color: isDarkMode ? '#F9FAFB' : '#111827',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Receipt Splitter
              </span>
            </div>
            <div className="flex items-center gap-3">
              <DarkModeToggle />
              <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">
                {user.email}
              </span>
              <Link
                href="/"
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                App
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page title + action */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your spending overview</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New session
          </Link>
        </div>

        {loadingData ? (
          <div className="text-center py-24 text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">No data yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-6">
              Save a session from the app to see your spending charts here
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start splitting
            </Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total spent</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalSpent)}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Receipts saved</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalReceipts}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Items tracked</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{items.length}</p>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Spending by category — donut */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">By category</h2>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {byCategory.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [fmt(v), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <ul className="flex-1 space-y-2 min-w-0">
                    {byCategory.map(entry => (
                      <li key={entry.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{entry.label}</span>
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium whitespace-nowrap">
                          {fmt(entry.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Spending over time — bar */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Over time</h2>
                {byMonth.length < 2 ? (
                  <div className="flex items-center justify-center h-[180px] text-sm text-gray-400 dark:text-gray-500">
                    Save more sessions to see trends
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byMonth} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(v), 'Spent']} />
                      <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent receipts */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent receipts</h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {receipts.slice(0, 10).map(receipt => {
                  const receiptItems = items.filter(i => i.receipt_id === receipt.id);
                  const total = receiptItems.reduce((s, i) => s + Number(i.current_price), 0);
                  return (
                    <div key={receipt.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{receipt.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {receiptItems.length} items · {new Date(receipt.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
