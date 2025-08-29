import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import dayjs from "dayjs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./GcrPage.css"; // ✅ Reuse same CSS

export default function DenialPage() {
  const [data, setData] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;
  const allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ✅ Load CSV
  useEffect(() => {
    fetch("/sample-data.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed = results.data.map((row) => {
              const billed = parseFloat(row.billed) || 0;
              const paid = parseFloat(row.paid) || 0;
              const adjusted_billed = parseFloat(row.adjusted_billed) || billed;
              const denied = row.denied === "True" || row.denied === true;
              const deniedAmount = parseFloat(row.deniedAmount) || 0;

              return {
                id: row.id ? Number(row.id) : Math.random(),
                billed,
                paid,
                adjusted_billed,
                denied,
                deniedAmount,
                reason: row.reason || "",
                payer: row.payer || "",
                client: row.client || "",
                date: row.date || "",
                month: row.date ? dayjs(row.date).format("MMM") : "", // ✅ match NCR
                aging: row.aging ? Number(row.aging) : 0,
                target: row.target ? parseFloat(row.target) : 0,
              };
            });
            setData(parsed);
          },
        });
      });
  }, []);

  // ✅ Unique clients
  const clients = useMemo(() => {
    const unique = Array.from(new Set(data.map((d) => d.client))).filter(Boolean);
    return ["All", ...unique];
  }, [data]);

  // ✅ Summary metrics
  const summaryMetrics = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth)
    );

    const totalClaims = filtered.length;
    const deniedClaims = filtered.filter((d) => d.denied).length;

    const denialRate =
      totalClaims === 0
        ? 0
        : parseFloat(((deniedClaims / totalClaims) * 100).toFixed(2));

    return { denialRate, totalClaims, deniedClaims };
  }, [data, selectedClient, selectedMonth]);

  // ✅ Monthly Denial Rate
  const filteredMonthlyData = useMemo(() => {
    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];

    return monthsToShow.map((month) => {
      const rows = data.filter(
        (d) =>
          (selectedClient === "All" || d.client === selectedClient) &&
          d.month === month
      );

      if (!rows.length) return { month, actual: 0, target: 10 };

      const totalClaims = rows.length;
      const deniedClaims = rows.filter((r) => r.denied).length;
      const monthlyDenialRate =
        totalClaims === 0
          ? 0
          : parseFloat(((deniedClaims / totalClaims) * 100).toFixed(2));

      return { month, actual: monthlyDenialRate, target: 10 };
    });
  }, [data, selectedClient, selectedMonth]);

  // ✅ Avg 3 Months vs Last Month
  const avgVsLastMonthData = useMemo(() => {
    const nonZeroMonths = filteredMonthlyData.filter((m) => m.actual !== 0);
    if (!nonZeroMonths.length) return [];

    const lastMonth = nonZeroMonths[nonZeroMonths.length - 1];
    const last3 = nonZeroMonths.slice(-3);
    const avg3 =
      last3.length > 0
        ? last3.reduce((s, m) => s + m.actual, 0) / last3.length
        : 0;

    return [
      { label: "Avg 3 Months", denial: parseFloat(avg3.toFixed(2)) },
      { label: "Last Month", denial: lastMonth.actual },
      { label: "Industry Standard", denial: 10 },
    ];
  }, [filteredMonthlyData]);

  // ✅ Payer Breakdown
  const aggregatedPayerData = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth)
    );

    const map = {};
    filtered.forEach((item) => {
      if (!map[item.payer]) {
        map[item.payer] = { name: item.payer, payments: 0, denied: 0 };
      }
      map[item.payer].payments += item.paid || 0;
      map[item.payer].denied += item.deniedAmount || 0;
    });
    return Object.values(map);
  }, [data, selectedClient, selectedMonth]);

  // ✅ Table Data
  const filteredTableData = useMemo(() => {
    return data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth)
    );
  }, [data, selectedClient, selectedMonth]);

  const totalPages = Math.ceil(filteredTableData.length / rowsPerPage);
  const currentData = filteredTableData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // ✅ Months for dropdown
  const monthsForClient = useMemo(() => ["All", ...allMonths], []);

  return (
    <div className="gcr-container">
      <h1 className="gcr-title">Denial Rate Dashboard</h1>

      {/* Summary + Filters */}
      <div className="summary-filters">
        <div className="summary-boxes">
          <div className="summary-box">
            <h4>Overall Denial Rate</h4>
            <p>{summaryMetrics.denialRate}%</p>
          </div>
          <div className="summary-box">
            <h4>Total Claims</h4>
            <p>{summaryMetrics.totalClaims}</p>
          </div>
          <div className="summary-box">
            <h4>Denied Claims</h4>
            <p>{summaryMetrics.deniedClaims}</p>
          </div>
        </div>

        <div className="filters">
          <div className="filter-box">
            <label>Client: </label>
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setCurrentPage(1);
                setSelectedMonth("All");
              }}
            >
              {clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-box">
            <label>Month: </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
            >
              {monthsForClient.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts">
        <div className="chart-card">
          <h3>Monthly Denial Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(t) => `${t}%`} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#ef4444" name="Denial Rate" />
              <Line type="monotone" dataKey="target" stroke="#10b981" name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Avg 3 Months vs Last Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgVsLastMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(t) => `${t}%`} />
              <Tooltip />
              <Legend />
              <Bar dataKey="denial" fill="#ef4444" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Payer Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={aggregatedPayerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Legend />
              <Bar dataKey="payments" fill="#10b981" barSize={20} name="Payments ($)" />
              <Bar dataKey="denied" fill="#ef4444" barSize={20} name="Denied ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="claim-table">
        <div className="claim-table-header">
          <h3>Claim Level Details</h3>
        </div>
        <div className="claim-table-body">
          <table>
            <thead>
              <tr>
                {[
                  "Claim ID",
                  "Billed Amount ($)",
                  "Adjusted Billed ($)",
                  "Paid Amount ($)",
                  "Adjustment Reason",
                  "Payer",
                  "Aging (days)",
                ].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, i) => (
                <tr key={`${row.id}-${i}`}>
                  <td>{row.id}</td>
                  <td>{row.billed}</td>
                  <td>{row.adjusted_billed}</td>
                  <td>{row.paid}</td>
                  <td>{row.reason}</td>
                  <td>{row.payer}</td>
                  <td>{row.aging}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>
            &lt;
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const pageNumber = startPage + i;
            return (
              <button
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={currentPage === pageNumber ? "active" : ""}
              >
                {pageNumber}
              </button>
            );
          })}
          <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
