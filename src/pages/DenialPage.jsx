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

export default function DenialRatePage() {
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
            const parsed = results.data.map((row, index) => ({
              id: row.id || `row-${index}`,
              billed: parseFloat(row.billed) || 0,
              paid: parseFloat(row.paid) || 0,
              reason: row.reason || "",
              payer: row.payer || "",
              client: row.client || "",
              date: row.date || "",
              month: row.date ? dayjs(row.date).format("MMM") : "",
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

  // ✅ Filtered only denials (denial = billed > 0 && paid = 0)
  const denialData = useMemo(() => {
    return data.filter(
      (d) =>
        d.billed > 0 &&
        d.paid === 0 &&
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth)
    );
  }, [data, selectedClient, selectedMonth]);

  // ✅ Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalDenials = denialData.length;
    const totalBilled = denialData.reduce((s, d) => s + d.billed, 0);
    return {
      totalDenials,
      totalBilled,
      denialRate: data.length > 0 ? ((totalDenials / data.length) * 100).toFixed(2) : 0,
    };
  }, [denialData, data]);

  // ✅ Monthly Denials Trend
  const filteredMonthlyData = useMemo(() => {
    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];
    return monthsToShow.map((month) => {
      const rows = data.filter(
        (d) =>
          d.billed > 0 &&
          d.paid === 0 &&
          (selectedClient === "All" || d.client === selectedClient) &&
          d.month === month
      );
      return { month, denials: rows.length };
    });
  }, [data, selectedClient, selectedMonth]);

  

  // ✅ Avg 3 Months vs Last Month
  const avgVsLastMonthData = useMemo(() => {
    const nonZeroMonths = filteredMonthlyData.filter((m) => m.denials > 0);
    if (!nonZeroMonths.length) return [];

    const lastMonth = nonZeroMonths[nonZeroMonths.length - 1];
    const last3 = nonZeroMonths.slice(-3);
    const avg3 =
      last3.reduce((s, m) => s + m.denials, 0) / last3.length;

    return [
      { label: "Avg 3 Months", denials: parseFloat(avg3.toFixed(0)) },
      { label: "Last Month", denials: lastMonth.denials },
    ];
  }, [filteredMonthlyData]);

  // ✅ Payer Breakdown
  // ✅ Payer Breakdown (how many denials per payer)
const aggregatedPayerData = useMemo(() => {
  const map = {};
  denialData.forEach((item) => {
    if (!map[item.payer]) {
      map[item.payer] = { name: item.payer, denials: 0 };
    }
    map[item.payer].denials += 1; // count denied claims per payer
  });
  return Object.values(map);
}, [denialData]);


  // ✅ Table Data
  const totalPages = Math.ceil(denialData.length / rowsPerPage);
  const currentData = denialData.slice(
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
      <h1 className="gcr-title">Denial Rate Dashboard</h1>

      {/* Summary + Filters */}
      <div className="summary-filters">
        <div className="summary-boxes">
          <div className="summary-box">
            <h4>Total Denials</h4>
            <p>{summaryMetrics.totalDenials}</p>
          </div>
          <div className="summary-box">
            <h4>Denied Billed Amount</h4>
            <p>${summaryMetrics.totalBilled.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <h4>Denial Rate</h4>
            <p>{summaryMetrics.denialRate}%</p>
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
          <h3>Monthly Denials</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="denials" stroke="#ef4444" />
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
              <Bar dataKey="denials" fill="#ef4444" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
  <h3>Payer Denial Breakdown</h3>
  <ResponsiveContainer width="100%" height={200}>
    <BarChart layout="vertical" data={aggregatedPayerData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" />
      <YAxis dataKey="name" type="category" />
      <Tooltip />
      <Legend />
      <Bar dataKey="denials" fill="#ef4444" barSize={10} name="Denied Claims" />
    </BarChart>
  </ResponsiveContainer>
</div>

      </div>

      {/* Table */}
      <div className="claim-table">
        <div className="claim-table-header">
          <h3>Denied Claim Details</h3>
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
