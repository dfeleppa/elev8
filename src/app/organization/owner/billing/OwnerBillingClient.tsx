"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, DollarSign, ArrowUpRight } from "lucide-react";

type Metrics = {
  mrr: number;
  arr: number;
  ltv: number;
  active_subscriptions: number;
  total_customers: number;
  churn_rate: number;
  total_revenue: number;
  timestamp?: string;
};

type Customer = {
  id: string;
  email: string;
  name: string;
  total_spent: number;
  subscription_status: string;
  subscription_amount: number;
  created_at: string;
};

type Transaction = {
  id: string;
  type: "payment" | "refund";
  amount: number;
  currency: string;
  status: string;
  customer_email: string;
  customer_name: string;
  description: string;
  created_at: string;
};

export default function OwnerBillingClient() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setMetricsLoading(true);
    setCustomersLoading(true);
    setTransactionsLoading(true);

    const refreshSuffix = forceRefresh ? `fresh=1&t=${Date.now()}` : "";
    const cacheOptions: RequestCache = forceRefresh ? "no-store" : "default";

    const metricsPath = forceRefresh
      ? `/api/owner/billing/metrics?${refreshSuffix}`
      : "/api/owner/billing/metrics";
    const customersPath = forceRefresh
      ? `/api/owner/billing/customers?limit=10&${refreshSuffix}`
      : "/api/owner/billing/customers?limit=10";
    const transactionsPath = forceRefresh
      ? `/api/owner/billing/transactions?limit=50&${refreshSuffix}`
      : "/api/owner/billing/transactions?limit=50";

    const results = await Promise.allSettled([
      (async () => {
        try {
          const res = await fetch(metricsPath, { cache: cacheOptions });
          if (!res.ok) throw new Error("Failed to fetch metrics");
          const data = await res.json();
          setMetrics(data);
        } finally {
          setMetricsLoading(false);
        }
      })(),
      (async () => {
        try {
          const res = await fetch(customersPath, { cache: cacheOptions });
          if (!res.ok) throw new Error("Failed to fetch customers");
          const data = await res.json();
          setCustomers(data.customers || []);
        } finally {
          setCustomersLoading(false);
        }
      })(),
      (async () => {
        try {
          const res = await fetch(transactionsPath, { cache: cacheOptions });
          if (!res.ok) throw new Error("Failed to fetch transactions");
          const data = await res.json();
          setTransactions(data.transactions || []);
        } finally {
          setTransactionsLoading(false);
        }
      })(),
    ]);

    const failures = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    if (failures.length > 0) {
      setError(failures[0].reason?.message || "Failed to fetch some billing data");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  const handleRefresh = async () => {
    await fetchData(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Billing</h1>
          <p className="text-slate-400 mt-2">Revenue, customers, and transaction management</p>
          {metrics?.timestamp && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {new Date(metrics.timestamp).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-slate-200 disabled:opacity-50 transition"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error} — {" "}
          <button onClick={handleRefresh} className="underline hover:text-red-300">
            Try again
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="glass-panel p-6 rounded-xl animate-pulse h-32 bg-white/5"
            />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR Card */}
          <div className="glass-panel p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-sm font-semibold">MRR</p>
              <DollarSign className="w-5 h-5 text-[#ffb1c4]" />
            </div>
            <p className="text-2xl font-bold text-white">${metrics.mrr.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-2">Monthly Recurring Revenue</p>
          </div>

          {/* ARR Card */}
          <div className="glass-panel p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-sm font-semibold">ARR</p>
              <TrendingUp className="w-5 h-5 text-[#63f7ff]" />
            </div>
            <p className="text-2xl font-bold text-white">${metrics.arr.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-2">Annual Recurring Revenue</p>
          </div>

          {/* Total Revenue Card */}
          <div className="glass-panel p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-sm font-semibold">Total Revenue</p>
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">${metrics.total_revenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-2">Lifetime total</p>
          </div>

          {/* Active Subscriptions Card */}
          <div className="glass-panel p-6 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-sm font-semibold">Active Subs</p>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{metrics.active_subscriptions}</p>
            <p className="text-xs text-slate-400 mt-2">{metrics.churn_rate.toFixed(1)}% churn rate</p>
          </div>
        </div>
      ) : null}

      {/* Customers Section */}
      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Recent Customers</h2>
        </div>
        {customersLoading ? (
          <div className="p-6 text-slate-400 text-sm">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-slate-400 text-sm">No customers yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Total Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 text-sm text-slate-400">{cust.email}</td>
                    <td className="px-6 py-4 text-sm text-white">{cust.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">${cust.total_spent.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        cust.subscription_status === "active"
                          ? "bg-green-500/20 text-green-300"
                          : cust.subscription_status === "paused"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-slate-500/20 text-slate-300"
                      }`}>
                        {cust.subscription_status || "none"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions Section */}
      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
        </div>
        {transactionsLoading ? (
          <div className="p-6 text-slate-400 text-sm">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-slate-400 text-sm">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 text-sm text-slate-400">{tx.customer_email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        tx.type === "payment"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-orange-500/20 text-orange-300"
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-white">${tx.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        tx.status === "succeeded"
                          ? "bg-green-500/20 text-green-300"
                          : tx.status === "failed"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-slate-500/20 text-slate-300"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
