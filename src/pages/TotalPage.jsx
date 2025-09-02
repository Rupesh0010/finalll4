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
import "./GcrPage.css"; // ✅ reuse same css

export default function TotalClaimsPage() {
  const [data, setData] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;

  const allMonths = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  // ✅ Load CSV and normalize month using date
  useEffect(() => {
    fetch("/sample-data.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed = results.data.map((row, index) => ({
              id: row.id || `row-${index}`,
              billed: parseFloat(row.billed) || 0,
              paid: parseFloat(row.paid) || 0,
              reason: row.reason || "",
              payer: row.payer || "",
              client: row.client || "",
              date: row.date || "",
              month: row.date ? dayjs(row.date).format("MMM") : "", // ✅ normalize like CCR
              aging: row.aging ? Number(row.aging) : 0,
            }));
            setData(parsed);
          },
        });
      });
  }, []);

  // ✅ Clients dropdown
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
    const totalBilled = filtered.reduce((sum, d) => sum + d.billed, 0);
    const totalPaid = filtered.reduce((sum, d) => sum + d.paid, 0);

    return { totalClaims, totalBilled, totalPaid };
  }, [data, selectedClient, selectedMonth]);

  // ✅ Monthly Claims Trend
  const filteredMonthlyData = useMemo(() => {
    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];
    return monthsToShow.map((month) => {
      const rows = data.filter(
        (d) => (selectedClient === "All" || d.client === selectedClient) && d.month === month
      );
      return { month, actual: rows.length };
    });
  }, [data, selectedClient, selectedMonth]);

  // ✅ Avg 3 Months vs Last Month
  const avgVsLastMonthData = useMemo(() => {
    const nonZeroMonths = filteredMonthlyData.filter((m) => m.actual > 0);
    if (!nonZeroMonths.length) return [];

    const lastMonth = nonZeroMonths[nonZeroMonths.length - 1];
    const last3 = nonZeroMonths.slice(-3);
    const avg3 =
      last3.reduce((s, m) => s + m.actual, 0) / last3.length;

    return [
      { label: "Avg 3 Months", claims: parseFloat(avg3.toFixed(0)) },
      { label: "Last Month", claims: lastMonth.actual },
    ];
  }, [filteredMonthlyData]);

  // ✅ Payer Breakdown
  const aggregatedPayerData = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth) &&
        d.payer
    );
    const map = {};
    filtered.forEach((item) => {
      if (!map[item.payer]) map[item.payer] = { name: item.payer, claims: 0 };
      map[item.payer].claims += 1;
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

  // ✅ Months per Client
  const monthsForClient = useMemo(() => {
    const uniqueMonths = new Set(
      data.filter((d) => selectedClient === "All" || d.client === selectedClient).map((d) => d.month)
    );
    return ["All", ...allMonths.filter((m) => uniqueMonths.has(m))];
  }, [data, selectedClient]);

  return (
    <div className="gcr-container">
      <h1 className="gcr-title">Total Claims Dashboard</h1>

      {/* Summary + Filters */}
      <div className="summary-filters">
        <div className="summary-boxes">
          <div className="summary-box">
            <h4>Total Claims</h4>
            <p>{summaryMetrics.totalClaims}</p>
          </div>
          <div className="summary-box">
            <h4>Total Billed</h4>
            <p>${summaryMetrics.totalBilled.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <h4>Total Paid</h4>
            <p>${summaryMetrics.totalPaid.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
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
                <option key={client} value={client}>{client}</option>
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
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts">
        <div className="chart-card">
          <h3>Monthly Total Claims</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Avg 3 Months vs Last Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgVsLastMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="claims" fill="#3b82f6" barSize={40} />
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
              <Bar dataKey="claims" fill="#3b82f6" barSize={10} name="Claims" />
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
                {["Claim ID","Billed Amount ($)","Paid Amount ($)","Adjustment Reason","Payer","Aging (days)"].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, index) => (
                <tr key={`${row.id}-${index}`}>
                  <td>{row.id}</td>
                  <td>{row.billed}</td>
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
          <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>&lt;</button>
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
          <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>&gt;</button>
        </div>
      </div>
    </div>
  );
}
