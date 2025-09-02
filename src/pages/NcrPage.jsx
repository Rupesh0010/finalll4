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
import "./GcrPage.css"; // ✅ reuse same CSS file

export default function NcrPage() {
  const [data, setData] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Load CSV
  useEffect(() => {
    fetch("/sample-data.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed = results.data.map((row) => ({
              id: row.id || `row-${index}`,
              billed: Number(row.billed),
              paid: Number(row.paid),
              adjustment: Number(row.adjustment) || 0,
              aging: Number(row.aging),
              reason: row.reason,
              payer: row.payer,
              client: row.client,
              date: row.date,
            }));
            setData(parsed);
          },
        });
      });
  }, []);

  /** 📌 Summary Metrics */
  const summaryMetrics = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || dayjs(d.date).format("MMM") === selectedMonth)
    );

    const totalBilled = filtered.reduce((sum, d) => sum + (d.billed || 0), 0);
    const totalPaid = filtered.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalAdj = filtered.reduce((sum, d) => sum + (d.adjustment || 0), 0);

    const denominator = totalBilled - totalAdj;
    const overallNcr = denominator > 0 ? ((totalPaid / denominator) * 100).toFixed(2) : 0;

    return { overallNcr, totalPaid, totalBilled, totalAdj };
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Monthly NCR Trend */
  const filteredMonthlyData = useMemo(() => {
    const monthlyAggregated = {};
    data.forEach((d) => {
      if (selectedClient === "All" || d.client === selectedClient) {
        const month = dayjs(d.date).format("MMM");
        if (!monthlyAggregated[month])
          monthlyAggregated[month] = { billed: 0, paid: 0, adj: 0 };
        monthlyAggregated[month].billed += d.billed || 0;
        monthlyAggregated[month].paid += d.paid || 0;
        monthlyAggregated[month].adj += d.adjustment || 0;
      }
    });

    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];

    return monthsToShow.map((month) => {
      const vals = monthlyAggregated[month];
      const denominator = vals ? vals.billed - vals.adj : 0;
      const actual = denominator > 0 ? ((vals.paid / denominator) * 100).toFixed(2) : 0;
      return { month, actual: +actual, target: 95 };
    });
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Avg vs Last Month */
  const avgVsLastMonthData = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || dayjs(d.date).format("MMM") === selectedMonth)
    );
    const totalBilled = filtered.reduce((sum, d) => sum + (d.billed || 0), 0);
    const totalPaid = filtered.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalAdj = filtered.reduce((sum, d) => sum + (d.adjustment || 0), 0);

    const denominator = totalBilled - totalAdj;
    const overallNcr = denominator > 0 ? ((totalPaid / denominator) * 100).toFixed(2) : 0;

    const industryStandard = 95;
    return [
      { label: "Avg 3 Months", ncr: +overallNcr },
      { label: "Last Month", ncr: +overallNcr },
      { label: "Industry Standard", ncr: industryStandard },
    ];
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Payer Breakdown */
  const filteredPayerData = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || dayjs(d.date).format("MMM") === selectedMonth)
    );
    const totalBilled = filtered.reduce((sum, d) => sum + (d.billed || 0), 0);
    const totalPaid = filtered.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalAdj = filtered.reduce((sum, d) => sum + (d.adjustment || 0), 0);
    const denominator = totalBilled - totalAdj;
    const denied = denominator - totalPaid;

    return [{ name: "All Payers", payments: totalPaid, denied }];
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Table Data */
  const filteredTableData = useMemo(() => {
    return data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" || dayjs(d.date).format("MMM") === selectedMonth)
    );
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Pagination */
  const totalPages = Math.ceil(filteredTableData.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentData = filteredTableData.slice(indexOfFirstRow, indexOfLastRow);

  const monthsForClient = useMemo(() => ["All", ...allMonths], []);

  return (
    <div className="gcr-container">
      <h1 className="gcr-title">Net Collection Rate (NCR) Dashboard</h1>

      {/* Filters + Summary */}
      <div className="summary-filters">
        <div className="summary-boxes">
          <div className="summary-box">
            <h4>Overall NCR</h4>
            <p>{summaryMetrics.overallNcr}%</p>
          </div>
          <div className="summary-box">
            <h4>Total Payment</h4>
            <p>${summaryMetrics.totalPaid.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <h4>Total Billed</h4>
            <p>${summaryMetrics.totalBilled.toLocaleString()}</p>
          </div>
          <div className="summary-box">
            <h4>Total Adjustments</h4>
            <p>${summaryMetrics.totalAdj.toLocaleString()}</p>
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
              <option value="All">All</option>
              {[...new Set(data.map((d) => d.client))].map((client) => (
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
          <h3>Monthly NCR Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#111" />
              <YAxis stroke="#111" tickFormatter={(tick) => `${tick}%`} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#10b981" name="Actual NCR" />
              <Line type="monotone" dataKey="target" stroke="#f43f5e" name="Target NCR" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Avg 3 Months vs Last Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgVsLastMonthData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" stroke="#111" />
              <YAxis stroke="#111" tickFormatter={(tick) => `${tick}%`} />
              <Tooltip />
              <Bar dataKey="ncr" fill="#5759ce" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Payer Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={filteredPayerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#111" />
              <YAxis dataKey="name" type="category" stroke="#111" />
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="payments" fill="#10b981" barSize={10} name="Payments ($)" />
              <Bar dataKey="denied" fill="#ef4444" barSize={10} name="Denied ($)" />
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
                {["Claim ID","Billed Amount ($)","Paid Amount ($)","Adjustment ($)","Adjustment Reason","Payer","Aging (days)"].map((header) => (
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
                  <td>{row.adjustment}</td>
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
