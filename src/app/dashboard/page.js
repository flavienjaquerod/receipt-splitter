'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/authContext';
import { useDarkMode } from '../../contexts/darkModeContext';
import { CATEGORIES } from '../../lib/categories';
import DarkModeToggle from '../../components/darkModeToggle';
import { FileText, Plus, LogOut, TrendingUp, Repeat, Check, X, Edit2, Trash2, ChevronLeft, ZoomIn, Target } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => `CHF ${Number(n).toFixed(2)}`;

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
];

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1)
    .toLocaleString('default', { month: 'short', year: '2-digit' });
}
function currentMonthKey() { return monthKey(new Date().toISOString()); }

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut, loading } = useAuth();
  const { isDarkMode } = useDarkMode();
  const router = useRouter();

  const [profile, setProfile]             = useState({ name: '' });
  const [editingName, setEditingName]     = useState(false);
  const [draftName, setDraftName]         = useState('');

  const [receipts, setReceipts]           = useState([]);
  const [items, setItems]                 = useState([]);
  const [recurring, setRecurring]         = useState([]);
  const [receiptImages, setReceiptImages] = useState({}); // { receipt_id: [{ url, filename }] }
  const [loadingData, setLoadingData]     = useState(true);
  const [lightbox, setLightbox]           = useState(null); // { url, filename }

  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [newRecurring, setNewRecurring]   = useState({ name: '', amount: '', category: 'other', frequency: 'monthly' });

  // Chart interaction
  const [enabledCategories, setEnabledCategories] = useState(null); // null = all enabled
  const [focusedCategory, setFocusedCategory]     = useState(null);

  // Budgets
  const [budgets, setBudgets]               = useState({}); // { category: amount }
  const [editingBudget, setEditingBudget]   = useState(null); // category key being edited
  const [draftBudget, setDraftBudget]       = useState('');
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set()); // dismissed this session

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: prof }, { data: r }, { data: i }, { data: rec }, { data: imgs }, { data: bdg }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).single(),
      supabase.from('receipts').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*, receipts(created_at)').order('created_at', { ascending: false }),
      supabase.from('recurring_payments').select('*').order('created_at', { ascending: false }),
      supabase.from('receipt_images').select('*').order('created_at', { ascending: true }),
      supabase.from('budgets').select('*').eq('user_id', user.id),
    ]);
    setProfile(prof || { name: '' });
    setDraftName(prof?.name || '');
    setReceipts(r || []);
    setItems(i || []);
    setRecurring(rec || []);

    // Generate signed URLs for all images (1 hour expiry)
    if (imgs && imgs.length > 0) {
      const paths = imgs.map(img => img.storage_path);
      const { data: signed } = await supabase.storage.from('receipts').createSignedUrls(paths, 3600);
      const byReceipt = {};
      imgs.forEach((img, idx) => {
        const url = signed?.[idx]?.signedUrl ?? null;
        if (!url) return;
        if (!byReceipt[img.receipt_id]) byReceipt[img.receipt_id] = [];
        byReceipt[img.receipt_id].push({ url, filename: img.filename });
      });
      setReceiptImages(byReceipt);
    }

    // Budgets: store as { category: amount }
    if (bdg) {
      const map = {};
      bdg.forEach(b => { map[b.category] = Number(b.amount); });
      setBudgets(map);
    }

    setLoadingData(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Profile ────────────────────────────────────────────────────────────────
  const saveName = async () => {
    const supabase = createClient();
    await supabase.from('profiles').upsert({ id: user.id, name: draftName, updated_at: new Date().toISOString() });
    setProfile(p => ({ ...p, name: draftName }));
    setEditingName(false);
  };

  // ── Recurring CRUD ─────────────────────────────────────────────────────────
  const addRecurring = async () => {
    const amount = parseFloat(newRecurring.amount);
    if (!newRecurring.name.trim() || isNaN(amount)) return;
    const supabase = createClient();
    const { data } = await supabase.from('recurring_payments')
      .insert({ user_id: user.id, name: newRecurring.name.trim(), amount, category: newRecurring.category, frequency: newRecurring.frequency, start_date: new Date().toISOString().slice(0, 10) })
      .select().single();
    if (data) setRecurring(prev => [data, ...prev]);
    setNewRecurring({ name: '', amount: '', category: 'other', frequency: 'monthly' });
    setShowAddRecurring(false);
  };

  const deleteRecurring = async (id) => {
    const supabase = createClient();
    await supabase.from('recurring_payments').delete().eq('id', id);
    setRecurring(prev => prev.filter(r => r.id !== id));
  };

  // ── Budget CRUD ────────────────────────────────────────────────────────────
  const saveBudget = async (category) => {
    const amount = parseFloat(draftBudget);
    if (isNaN(amount) || amount <= 0) { setEditingBudget(null); return; }
    const supabase = createClient();
    await supabase.from('budgets').upsert(
      { user_id: user.id, category, amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category' }
    );
    setBudgets(prev => ({ ...prev, [category]: amount }));
    setEditingBudget(null);
    setDraftBudget('');
  };

  const deleteBudget = async (category) => {
    const supabase = createClient();
    await supabase.from('budgets').delete().eq('user_id', user.id).eq('category', category);
    setBudgets(prev => { const n = { ...prev }; delete n[category]; return n; });
  };

  // ── Analytics ──────────────────────────────────────────────────────────────

  const thisMonthKey = currentMonthKey();
  const thisMonthItems     = items.filter(i => i.receipts?.created_at && monthKey(i.receipts.created_at) === thisMonthKey);
  const thisMonthOneTime   = thisMonthItems.reduce((s, i) => s + Number(i.current_price), 0);
  const thisMonthRecurring = recurring.reduce((s, r) => {
    if (r.frequency === 'monthly') return s + Number(r.amount);
    if (r.frequency === 'yearly' && new Date(r.start_date).getMonth() === new Date().getMonth()) return s + Number(r.amount);
    return s;
  }, 0);
  const thisMonthTotal     = thisMonthOneTime + thisMonthRecurring;
  const totalSpent         = items.reduce((s, i) => s + Number(i.current_price), 0);
  const monthlyFixed       = recurring.filter(r => r.frequency === 'monthly').reduce((s, r) => s + Number(r.amount), 0);

  // This month's spending per category (purchases + recurring)
  const thisMonthByCategory = (() => {
    const map = {};
    thisMonthItems.forEach(item => {
      const key = item.category || 'other';
      map[key] = (map[key] || 0) + Number(item.current_price);
    });
    recurring.forEach(r => {
      const key = r.category || 'other';
      const monthly = r.frequency === 'monthly' ? Number(r.amount) : (new Date(r.start_date).getMonth() === new Date().getMonth() ? Number(r.amount) : 0);
      if (monthly > 0) map[key] = (map[key] || 0) + monthly;
    });
    return map;
  })();

  // ── Category data (purchases + recurring monthly equivalent) ──────────────
  const allCategoryData = (() => {
    const map = {};

    // One-time purchases
    items.forEach(item => {
      const key = item.category || 'other';
      map[key] = map[key] || { purchases: 0, fixed: 0 };
      map[key].purchases += Number(item.current_price);
    });

    // Recurring (as monthly equivalent)
    recurring.forEach(r => {
      const key = r.category || 'other';
      const monthly = r.frequency === 'monthly' ? Number(r.amount) : Number(r.amount) / 12;
      map[key] = map[key] || { purchases: 0, fixed: 0 };
      map[key].fixed += monthly;
    });

    return Object.entries(map).map(([key, v]) => ({
      key,
      label: CATEGORIES[key]?.label ?? 'Other',
      total: v.purchases + v.fixed,
      purchases: v.purchases,
      fixed: v.fixed,
      color: isDarkMode ? (CATEGORIES[key]?.dark ?? '#9CA3AF') : (CATEGORIES[key]?.light ?? '#6B7280'),
    })).sort((a, b) => b.total - a.total);
  })();

  const enabled = enabledCategories ?? new Set(allCategoryData.map(e => e.key));
  const visibleCategoryData = allCategoryData.filter(e => enabled.has(e.key));

  const toggleCategory = (key) => {
    const next = new Set(enabled);
    if (next.has(key)) {
      if (next.size === 1) return; // keep at least one visible
      next.delete(key);
    } else {
      next.add(key);
    }
    setEnabledCategories(next);
    if (focusedCategory === key) setFocusedCategory(null);
  };

  // ── Drill-down data for focused category ──────────────────────────────────
  const drillData = focusedCategory ? (() => {
    // Items in this category by month
    const byMonth = {};
    items.filter(i => (i.category || 'other') === focusedCategory).forEach(item => {
      const date = item.receipts?.created_at;
      if (!date) return;
      const k = monthKey(date);
      byMonth[k] = (byMonth[k] || 0) + Number(item.current_price);
    });

    const monthlyBars = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, total]) => ({ month: monthLabel(k), total }));

    // Top items in this category
    const topItems = items
      .filter(i => (i.category || 'other') === focusedCategory)
      .sort((a, b) => Number(b.current_price) - Number(a.current_price))
      .slice(0, 8);

    // Recurring in this category
    const recurringInCat = recurring.filter(r => (r.category || 'other') === focusedCategory);

    return { monthlyBars, topItems, recurringInCat };
  })() : null;

  // ── Monthly stacked bar (purchases + recurring) ────────────────────────────
  const byMonth = (() => {
    const map = {};
    items.forEach(item => {
      const date = item.receipts?.created_at;
      if (!date) return;
      const k = monthKey(date);
      map[k] = map[k] || { oneTime: 0, recurringCost: 0 };
      map[k].oneTime += Number(item.current_price);
    });
    const keys = Object.keys(map);
    recurring.filter(r => r.frequency === 'monthly').forEach(r => {
      keys.forEach(k => { map[k].recurringCost += Number(r.amount); });
    });
    recurring.filter(r => r.frequency === 'yearly').forEach(r => {
      const k = monthKey(r.start_date);
      if (map[k]) map[k].recurringCost += Number(r.amount);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([k, v]) => ({ month: monthLabel(k), oneTime: v.oneTime, recurring: v.recurringCost }));
  })();

  const axisColor  = isDarkMode ? '#9CA3AF' : '#6B7280';
  const gridColor  = isDarkMode ? '#374151' : '#E5E7EB';
  const tooltipSty = { backgroundColor: isDarkMode ? '#1F2937' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, color: isDarkMode ? '#F9FAFB' : '#111827', fontSize: 12 };

  if (loading || !user) return null;

  const focusedCat = focusedCategory ? (CATEGORIES[focusedCategory] || CATEGORIES.other) : null;
  const focusedColor = focusedCat ? (isDarkMode ? focusedCat.dark : focusedCat.light) : null;

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
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Receipt Splitter</span>
            </div>
            <div className="flex items-center gap-3">
              <DarkModeToggle />
              <Link href="/" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">App</Link>
              <button onClick={signOut} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Title + profile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.name ? `Hey, ${profile.name}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your spending overview · costs shown are your share only</p>
          </div>
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input value={draftName} onChange={e => setDraftName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()} placeholder="Your name"
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                <button onClick={saveName} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingName(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Edit2 className="w-3 h-3" />{profile.name ? 'Edit name' : 'Set your name'}
              </button>
            )}
            <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New session
            </Link>
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-24 text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(thisMonthTotal)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmt(thisMonthOneTime)} + {fmt(thisMonthRecurring)} fixed</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">All-time purchases</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalSpent)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{items.length} items · {receipts.length} receipts</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fixed / month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(monthlyFixed)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{recurring.filter(r => r.frequency === 'monthly').length} recurring</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg / month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {byMonth.length > 0 ? fmt(byMonth.reduce((s, m) => s + m.oneTime + m.recurring, 0) / byMonth.length) : 'CHF 0.00'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">over {byMonth.length} month{byMonth.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* ── Budget alerts banner ── */}
            {(() => {
              const alerts = Object.entries(budgets).filter(([cat, limit]) => {
                const spent = thisMonthByCategory[cat] || 0;
                return spent >= limit * 0.75;
              }).map(([cat, limit]) => {
                const spent = thisMonthByCategory[cat] || 0;
                const over = spent > limit;
                const pct = Math.round((spent / limit) * 100);
                const color = over ? '#EF4444' : '#F97316';
                const catLabel = CATEGORIES[cat]?.label ?? cat;
                return { cat, spent, limit, over, pct, color, catLabel };
              });
              const visible = alerts.filter(a => !dismissedAlerts.has(a.cat));
              if (visible.length === 0) return null;
              return (
                <div className="space-y-2">
                  {visible.map(a => (
                    <div key={a.cat} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                      style={{ backgroundColor: a.color + '18', border: `1px solid ${a.color}44`, color: a.color }}>
                      <Target className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">
                        {a.over
                          ? `${a.catLabel} budget exceeded — spent ${fmt(a.spent)} of ${fmt(a.limit)} limit (${a.pct}%)`
                          : `${a.catLabel} budget at ${a.pct}% — ${fmt(a.limit - a.spent)} remaining this month`}
                      </span>
                      <button
                        onClick={() => setDismissedAlerts(prev => new Set([...prev, a.cat]))}
                        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Category chart ── */}
            {allCategoryData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">

                {focusedCategory ? (
                  /* ── Drill-down view ── */
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <button onClick={() => setFocusedCategory(null)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                        <ChevronLeft className="w-4 h-4" /> All categories
                      </button>
                      <span className="px-2.5 py-0.5 text-sm rounded-full font-medium"
                        style={{ color: focusedColor, backgroundColor: focusedColor + '22', border: `1px solid ${focusedColor}44` }}>
                        {focusedCat?.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Monthly bar for this category */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Monthly spending</p>
                        {drillData.monthlyBars.length < 1 ? (
                          <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No purchase data</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={drillData.monthlyBars} barSize={20}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                              <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipSty} formatter={v => [fmt(v), 'Spent']} />
                              <Bar dataKey="total" fill={focusedColor} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Top items + recurring */}
                      <div className="space-y-4">
                        {drillData.recurringInCat.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recurring</p>
                            <div className="space-y-1.5">
                              {drillData.recurringInCat.map(r => (
                                <div key={r.id} className="flex justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300">{r.name} <span className="text-xs text-gray-400 capitalize">({r.frequency})</span></span>
                                  <span className="font-medium text-gray-900 dark:text-white">{fmt(r.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {drillData.topItems.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top purchases</p>
                            <div className="space-y-1.5">
                              {drillData.topItems.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300 truncate mr-3">{item.translated_name || item.name}</span>
                                  <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmt(item.current_price)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {drillData.topItems.length === 0 && drillData.recurringInCat.length === 0 && (
                          <p className="text-sm text-gray-400 dark:text-gray-500 pt-8 text-center">No items in this category</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Overview donut ── */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">By category</h2>
                      <p className="text-xs text-gray-400 dark:text-gray-500">purchases + monthly fixed · click to filter or drill in</p>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Donut */}
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <ResponsiveContainer width={200} height={200}>
                          <PieChart>
                            <Pie data={visibleCategoryData} dataKey="total" nameKey="label"
                              cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}
                              onClick={(_, index) => setFocusedCategory(visibleCategoryData[index]?.key ?? null)}
                              style={{ cursor: 'pointer' }}
                            >
                              {visibleCategoryData.map(e => (
                                <Cell key={e.key} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipSty} formatter={v => [fmt(v), '']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend — clickable, with budget bars */}
                      <ul className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 content-start">
                        {allCategoryData.map(e => {
                          const isOn = enabled.has(e.key);
                          const budget = budgets[e.key];
                          const spent = thisMonthByCategory[e.key] || 0;
                          const pct = budget ? Math.min((spent / budget) * 100, 100) : null;
                          const over = budget && spent > budget;
                          const warn = budget && pct >= 75 && !over;
                          const barColor = over ? '#EF4444' : warn ? '#F97316' : e.color;
                          return (
                            <li key={e.key} className={`space-y-1 transition-opacity ${isOn ? 'opacity-100' : 'opacity-35'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  onClick={() => toggleCategory(e.key)}
                                  className="flex items-center gap-2 text-sm min-w-0"
                                >
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                                  <span className="truncate text-gray-700 dark:text-gray-300">{e.label}</span>
                                </button>
                                <button
                                  onClick={() => isOn && setFocusedCategory(e.key)}
                                  className={`text-xs font-medium whitespace-nowrap ${isOn ? 'text-gray-900 dark:text-white hover:underline' : 'text-gray-400 pointer-events-none'}`}
                                >
                                  {fmt(e.total)}
                                </button>
                              </div>
                              {/* Budget progress bar */}
                              {budget && (
                                <div>
                                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] mt-0.5">
                                    <span style={{ color: barColor }} className="font-medium">
                                      {over ? `${fmt(spent - budget)} over` : `${fmt(spent)} of ${fmt(budget)}`}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500">{Math.round(pct)}%</span>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {enabledCategories !== null && (
                      <button onClick={() => setEnabledCategories(null)}
                        className="mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        Reset filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Monthly bar chart */}
            {byMonth.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Monthly spending</h2>
                {byMonth.length < 2 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">Save more sessions to see trends</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={byMonth} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipSty} formatter={v => [fmt(v), '']} />
                        <Bar dataKey="oneTime"   name="Purchases" fill="#3B82F6" radius={[0, 0, 0, 0]} stackId="a" />
                        <Bar dataKey="recurring" name="Recurring"  fill="#A855F7" radius={[4, 4, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Purchases (your share)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />Recurring</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Budget limits ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Monthly budget limits</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  const color = isDarkMode ? cat.dark : cat.light;
                  const budget = budgets[key];
                  const spent = thisMonthByCategory[key] || 0;
                  const isEditing = editingBudget === key;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                      <span className="flex items-center gap-2 text-sm min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate text-gray-700 dark:text-gray-300">{cat.label}</span>
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              value={draftBudget}
                              onChange={e => setDraftBudget(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveBudget(key); if (e.key === 'Escape') setEditingBudget(null); }}
                              placeholder="CHF"
                              className="w-20 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button onClick={() => saveBudget(key)} className="text-green-600 dark:text-green-400 hover:opacity-80">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingBudget(null)} className="text-gray-400 hover:opacity-80">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : budget ? (
                          <>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{fmt(budget)}</span>
                            <button onClick={() => { setEditingBudget(key); setDraftBudget(String(budget)); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteBudget(key)} className="text-red-400 hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingBudget(key); setDraftBudget(''); }}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                          >
                            + set limit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recurring payments */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-purple-500" />
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recurring payments</h2>
                </div>
                <button onClick={() => setShowAddRecurring(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {showAddRecurring && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex flex-wrap gap-3">
                  <input placeholder="Name (e.g. Rent)" value={newRecurring.name}
                    onChange={e => setNewRecurring(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="number" placeholder="Amount (CHF)" value={newRecurring.amount}
                    onChange={e => setNewRecurring(p => ({ ...p, amount: e.target.value }))}
                    className="w-36 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={newRecurring.category} onChange={e => setNewRecurring(p => ({ ...p, category: e.target.value }))}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                  <select value={newRecurring.frequency} onChange={e => setNewRecurring(p => ({ ...p, frequency: e.target.value }))}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <button onClick={addRecurring} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Save</button>
                </div>
              )}

              {recurring.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No recurring payments — add rent, subscriptions, utilities…</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recurring.map(r => {
                    const cat = CATEGORIES[r.category] || CATEGORIES.other;
                    const color = isDarkMode ? cat.dark : cat.light;
                    return (
                      <div key={r.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap"
                            style={{ color, backgroundColor: color + '22', border: `1px solid ${color}44` }}>
                            {cat.label}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{r.frequency}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(r.amount)}</span>
                          <button onClick={() => deleteRecurring(r.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent receipts */}
            {receipts.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent receipts</h2>
                <div className="space-y-4">
                  {receipts.slice(0, 10).map(receipt => {
                    const rItems = items.filter(i => i.receipt_id === receipt.id);
                    const total = rItems.reduce((s, i) => s + Number(i.current_price), 0);
                    const images = receiptImages[receipt.id] || [];
                    return (
                      <div key={receipt.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{receipt.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{rItems.length} items · {new Date(receipt.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(total)}</span>
                        </div>

                        {/* Image thumbnails */}
                        {images.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {images.map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => setLightbox(img)}
                                className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-blue-500 transition-all group flex-shrink-0"
                              >
                                <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lightbox */}
            {lightbox && (
              <div
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                onClick={() => setLightbox(null)}
              >
                <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setLightbox(null)}
                    className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <img
                    src={lightbox.url}
                    alt={lightbox.filename}
                    className="w-full h-full object-contain rounded-xl"
                  />
                  <p className="text-center text-white/50 text-xs mt-3">{lightbox.filename}</p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {allCategoryData.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">No spending data yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-6">Save a session from the app or add recurring payments above</p>
                <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Start splitting
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
