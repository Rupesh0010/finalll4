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
import "./GcrPage.css"; // Re-uses same CSS

export default function BillingLagPage() {
  const [data, setData] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;
  const allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Load CSV and parse lag days
  useEffect(() => {
    fetch("/sample-data.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed = results.data
              .map((row, index) => {
                const serviceDate = row.service_date || "";
                const billedDate = row.billing_date || ""; // ✅ FIXED

                let lag = null;
                if (serviceDate && billedDate) {
                  const sDate = dayjs(serviceDate, "YYYY-MM-DD");
                  const bDate = dayjs(billedDate, "YYYY-MM-DD");
                  if (sDate.isValid() && bDate.isValid()) {
                    lag = bDate.diff(sDate, "day");
                  }
                }

                return {
                  id: row.id || `row-${index}`,
                  billed: parseFloat(row.billed) || 0,
                  client: row.client || "",
                  payer: row.payer || "",
                  serviceDate,
                  billedDate,
                  lag,
                  month: billedDate
                    ? dayjs(billedDate, "YYYY-MM-DD").format("MMM")
                    : "",
                };
              })
              .filter((d) => d.lag !== null); // ✅ skip invalid rows

            setData(parsed);
          },
        });
      });
  }, []);

  // Clients dropdown
  const clients = useMemo(() => {
    const unique = Array.from(new Set(data.map((d) => d.client))).filter(Boolean);
    return ["All", ...unique];
  }, [data]);

  // Filtered billing data
  const billingLagData = useMemo(() => {
    return data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || d.month === selectedMonth)
    );
  }, [data, selectedClient, selectedMonth]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalRows = billingLagData.length;
    const avgLag =
      totalRows > 0
        ? (
            billingLagData.reduce((s, d) => s + d.lag, 0) / totalRows
          ).toFixed(2)
        : 0;
    const totalBilled = billingLagData.reduce((s, d) => s + d.billed, 0);
    return {
      totalRows,
      avgLag,
      totalBilled,
    };
  }, [billingLagData]);

  // Monthly Lag Trend
  const filteredMonthlyData = useMemo(() => {
    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];
    return monthsToShow.map((month) => {
      const rows = billingLagData.filter((d) => d.month === month);
      const avgLag =
        rows.length > 0
          ? rows.reduce((s, d) => s + d.lag, 0) / rows.length
          : 0;
      return { month, avgLag: parseFloat(avgLag.toFixed(2)) };
    });
  }, [billingLagData, selectedMonth]);

  // Avg 3 Months vs Last Month
  const avgVsLastMonthData = useMemo(() => {
    const nonZeroMonths = filteredMonthlyData.filter((m) => m.avgLag > 0);
    if (!nonZeroMonths.length) return [];
    const lastMonth = nonZeroMonths[nonZeroMonths.length - 1];
    const last3 = nonZeroMonths.slice(-3);
    const avg3 =
      last3.reduce((s, m) => s + m.avgLag, 0) / last3.length;
    return [
      { label: "Avg 3 Months", avgLag: parseFloat(avg3.toFixed(2)) },
      { label: "Last Month", avgLag: lastMonth.avgLag },
    ];
  }, [filteredMonthlyData]);

  // Payer lag breakdown (avg lag per payer)
  const aggregatedPayerData = useMemo(() => {
    const map = {};
    billingLagData.forEach((item) => {
      if (!map[item.payer]) {
        map[item.payer] = { name: item.payer, totalLag: 0, count: 0 };
      }
      map[item.payer].totalLag += item.lag;
      map[item.payer].count += 1;
    });
    return Object.values(map).map((payer) => ({
      name: payer.name,
      avgLag:
        payer.count > 0
          ? parseFloat((payer.totalLag / payer.count).toFixed(2))
          : 0,
    }));
  }, [billingLagData]);

  // Table Data
  const totalPages = Math.ceil(billingLagData.length / rowsPerPage);
  const currentData = billingLagData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Months per Client
  const monthsForClient = useMemo(() => {
    const uniqueMonths = new Set(
      data
        .filter((d) => selectedClient === "All" || d.client === selectedClient)
        .map((d) => d.month)
    );
    return ["All", ...allMonths.filter((m) => uniqueMonths.has(m))];
  }, [data, selectedClient]);

  return (
    <div className="gcr-container">
      <h1 className="gcr-title">Billing Lag Dashboard</h1>

      {/* Summary + Filters */}
      <div className="summary-filters">
        <div className="summary-boxes">
          <div className="summary-box">
            <h4>Total Claims</h4>
            <p>{summaryMetrics.totalRows}</p>
          </div>
          <div className="summary-box">
            <h4>Avg Billing Lag (days)</h4>
            <p>{summaryMetrics.avgLag}</p>
          </div>
          <div className="summary-box">
            <h4>Billed Amount</h4>
            <p>${summaryMetrics.totalBilled.toLocaleString()}</p>
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
          <h3>Monthly Average Billing Lag</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                label={{ value: "Days", angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgLag" stroke="#10b981" />
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
              <Bar dataKey="avgLag" fill="#10b981" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Payer Lag Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={aggregatedPayerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                label={{ value: "Days", angle: 0, position: "bottom" }}
              />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="avgLag"
                fill="#10b981"
                barSize={20}
                name="Avg Lag (days)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="claim-table">
        <div className="claim-table-header">
          <h3>Billing Lag Details</h3>
        </div>
        <div className="claim-table-body">
          <table>
            <thead>
              <tr>
                {[
                  "Claim ID",
                  "Service Date",
                  "Billed Date",
                  "Billing Lag (days)",
                  "Client",
                  "Payer",
                  "Billed Amount ($)",
                ].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, index) => (
                <tr key={`${row.id}-${index}`}>
                  <td>{row.id}</td>
                  <td>{row.serviceDate}</td>
                  <td>{row.billedDate}</td>
                  <td>{row.lag}</td>
                  <td>{row.client}</td>
                  <td>{row.payer}</td>
                  <td>{row.billed}</td>
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
            let startPage = Math.max(
              1,
              Math.min(currentPage - 2, totalPages - 4)
            );
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
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
