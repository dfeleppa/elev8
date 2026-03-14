"use client";

import { useMemo, useState } from "react";

type PayrollRow = {
  week: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  staffName: string;
  classesCoached: number;
  officeHours: number;
  totalPay: number;
  payDate: string;
  paymentForm: string;
  notes: string;
};

type SortColumn =
  | "week"
  | "payPeriod"
  | "staffName"
  | "classesCoached"
  | "officeHours"
  | "totalPay"
  | "payDate"
  | "paymentForm"
  | "notes";

type SortDirection = "asc" | "desc";

const seedRows: PayrollRow[] = [
  {
    week: 1,
    payPeriodStart: "2026-01-04",
    payPeriodEnd: "2026-01-10",
    staffName: "Brianna",
    classesCoached: 1,
    officeHours: 2,
    totalPay: 100,
    payDate: "2026-01-14",
    paymentForm: "Direct Deposit",
    notes: "N/A",
  },
  {
    week: 2,
    payPeriodStart: "2026-01-11",
    payPeriodEnd: "2026-01-17",
    staffName: "Marcus",
    classesCoached: 6,
    officeHours: 4,
    totalPay: 420,
    payDate: "2026-01-21",
    paymentForm: "Direct Deposit",
    notes: "Covered one extra class",
  },
  {
    week: 3,
    payPeriodStart: "2026-01-18",
    payPeriodEnd: "2026-01-24",
    staffName: "Nina",
    classesCoached: 4,
    officeHours: 6,
    totalPay: 390,
    payDate: "2026-01-28",
    paymentForm: "Check",
    notes: "Includes onboarding admin hours",
  },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatPeriod(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }

  const short = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" });
  return `${short.format(startDate)} - ${short.format(endDate)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function compareRows(a: PayrollRow, b: PayrollRow, column: SortColumn) {
  switch (column) {
    case "week":
      return a.week - b.week;
    case "payPeriod": {
      const left = new Date(a.payPeriodStart).getTime();
      const right = new Date(b.payPeriodStart).getTime();
      return left - right;
    }
    case "classesCoached":
      return a.classesCoached - b.classesCoached;
    case "officeHours":
      return a.officeHours - b.officeHours;
    case "totalPay":
      return a.totalPay - b.totalPay;
    case "payDate": {
      const left = new Date(a.payDate).getTime();
      const right = new Date(b.payDate).getTime();
      return left - right;
    }
    case "staffName":
      return a.staffName.localeCompare(b.staffName);
    case "paymentForm":
      return a.paymentForm.localeCompare(b.paymentForm);
    case "notes":
      return a.notes.localeCompare(b.notes);
    default:
      return 0;
  }
}

export default function OwnerPayrollClient() {
  const [rows] = useState<PayrollRow[]>(seedRows);
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("week");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const staffOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.staffName))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const paymentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.paymentForm))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (staffFilter !== "all" && row.staffName !== staffFilter) {
          return false;
        }
        if (paymentFilter !== "all" && row.paymentForm !== paymentFilter) {
          return false;
        }
        if (!query) {
          return true;
        }

        const haystack = [
          row.week,
          formatPeriod(row.payPeriodStart, row.payPeriodEnd),
          row.staffName,
          row.classesCoached,
          row.officeHours,
          row.totalPay,
          formatDate(row.payDate),
          row.paymentForm,
          row.notes,
        ]
          .map((value) => String(value).toLowerCase())
          .join(" ");

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const result = compareRows(a, b, sortColumn);
        return sortDirection === "asc" ? result : -result;
      });
  }, [rows, search, staffFilter, paymentFilter, sortColumn, sortDirection]);

  const onSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  const headingClass = (column: SortColumn) => {
    const active = sortColumn === column;
    return `font-semibold transition ${active ? "text-slate-100" : "text-slate-400 hover:text-slate-200"}`;
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Payroll</h1>
        <p className="mt-3 text-sm text-slate-400">
          Track weekly payroll by staff, pay period, and payout details.
        </p>
      </header>

      <section className="glass-panel rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search week, staff, pay period, payment form, notes"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          />

          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          >
            <option value="all">All Staff</option>
            {staffOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
          >
            <option value="all">All Payment Forms</option>
            {paymentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[1180px] border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.22em] text-slate-400">
                <th className="px-4">
                  <button type="button" onClick={() => onSort("week")} className={headingClass("week")}>
                    Week
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("payPeriod")} className={headingClass("payPeriod")}>
                    Pay Period
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("staffName")} className={headingClass("staffName")}>
                    Staff Name
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("classesCoached")} className={headingClass("classesCoached")}>
                    Classes Coached
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("officeHours")} className={headingClass("officeHours")}>
                    Office Hours
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("totalPay")} className={headingClass("totalPay")}>
                    Total Pay
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("payDate")} className={headingClass("payDate")}>
                    Pay Date
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("paymentForm")} className={headingClass("paymentForm")}>
                    Payment Form
                  </button>
                </th>
                <th className="px-4">
                  <button type="button" onClick={() => onSort("notes")} className={headingClass("notes")}>
                    Notes
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400"
                  >
                    No payroll rows match the current search/filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={`${row.week}-${row.staffName}-${index}`}>
                    <td className="rounded-l-2xl border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                      {row.week}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {formatPeriod(row.payPeriodStart, row.payPeriodEnd)}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-100">
                      {row.staffName}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.classesCoached}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.officeHours}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-emerald-300">
                      {formatMoney(row.totalPay)}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {formatDate(row.payDate)}
                    </td>
                    <td className="border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.paymentForm}
                    </td>
                    <td className="rounded-r-2xl border-y border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      {row.notes || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
