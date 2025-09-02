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
import "./GcrPage.css";

// ✅ Helper component updated to show percentage and handle positioning
const TrendIndicator = ({ trendInfo }) => {
  const { trend, percentage } = trendInfo;

  if (!trend || trend === "steady") {
    return null;
  }

  const isIncrease = trend === "increase";
  const color = isIncrease ? "#10b981" : "#ef4444";
  const arrow = isIncrease ? "▲" : "▼";
  const sign = isIncrease ? "+" : "";

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        right: "15px",
        fontSize: "1em",
        fontWeight: "500",
        display: "flex",
        alignItems: "center",
        color: color,
      }}
    >
      <span style={{ marginRight: "4px" }}>{arrow}</span>
      {/* Only show percentage if it's a valid number */}
      {percentage !== null && <span>{sign}{percentage}%</span>}
    </div>
  );
};


export default function GcrPage() {
  const [data, setData] = useState([]);
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const allMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

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
              denied: Number(row.denied) || 0,
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
  
  // ✅ kpiMetrics hook updated to calculate trend percentage
  const kpiMetrics = useMemo(() => {
    const getMetricsForMonth = (month) => {
      const filtered = data.filter(
        (d) =>
          (selectedClient === "All" || d.client === selectedClient) &&
          (month === "All" || dayjs(d.date).format("MMM") === month)
      );

      const totalBilled = filtered.reduce((sum, d) => sum + d.billed, 0);
      const totalPaid = filtered.reduce((sum, d) => sum + d.paid, 0);
      const gcr = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
      return { totalBilled, totalPaid, gcr };
    };

    // Helper to get trend direction and percentage
    const getTrendDetails = (current, previous) => {
      let trend = "steady";
      if (previous === 0 && current > 0) trend = "increase";
      else if (current > previous) trend = "increase";
      else if (current < previous) trend = "decrease";
      
      let percentage = null;
      if (previous > 0) {
        percentage = (((current - previous) / previous) * 100).toFixed(1);
      }
      
      return { trend, percentage };
    };
    
    let currentTrendPeriodMonth = selectedMonth;
    let previousTrendPeriodMonth = null;

    if (selectedMonth === "All") {
      const clientFiltered = data.filter(d => selectedClient === "All" || d.client === selectedClient);
      const sortedDates = [...clientFiltered].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      
      if (sortedDates.length > 0) {
        const lastDate = dayjs(sortedDates[0].date);
        currentTrendPeriodMonth = lastDate.format("MMM");
        previousTrendPeriodMonth = lastDate.subtract(1, "month").format("MMM");
      }
    } else {
      const monthIndex = allMonths.indexOf(selectedMonth);
      if (monthIndex > 0) {
        previousTrendPeriodMonth = allMonths[monthIndex - 1];
      }
    }

    const mainMetrics = getMetricsForMonth(selectedMonth);
    const trendCurrentMetrics = getMetricsForMonth(currentTrendPeriodMonth);
    const trendPreviousMetrics = getMetricsForMonth(previousTrendPeriodMonth);

    return {
      overallGcr: mainMetrics.gcr.toFixed(2),
      totalPaid: mainMetrics.totalPaid,
      totalBilled: mainMetrics.totalBilled,
      gcrTrend: getTrendDetails(trendCurrentMetrics.gcr, trendPreviousMetrics.gcr),
      paidTrend: getTrendDetails(trendCurrentMetrics.totalPaid, trendPreviousMetrics.totalPaid),
      billedTrend: getTrendDetails(trendCurrentMetrics.totalBilled, trendPreviousMetrics.totalBilled),
    };
  }, [data, selectedClient, selectedMonth, allMonths]);

  // --- Other useMemo hooks remain unchanged ---

  /** 📌 Monthly GCR Trend */
  const filteredMonthlyData = useMemo(() => {
    const monthlyAggregated = {};
    data.forEach((d) => {
      if (selectedClient === "All" || d.client === selectedClient) {
        const month = dayjs(d.date).format("MMM");
        if (!monthlyAggregated[month])
          monthlyAggregated[month] = { billed: 0, paid: 0 };
        monthlyAggregated[month].billed += d.billed || 0;
        monthlyAggregated[month].paid += d.paid || 0;
      }
    });
    const monthsToShow = selectedMonth === "All" ? allMonths : [selectedMonth];
    return monthsToShow.map((month) => {
      const vals = monthlyAggregated[month];
      const actual =
        vals && vals.billed > 0
          ? ((vals.paid / vals.billed) * 100).toFixed(2)
          : 0;
      return { month, actual: +actual, target: 95 };
    });
  }, [data, selectedClient, selectedMonth, allMonths]);

  /** 📌 Avg vs Last Month (Formula Corrected) */
  const avgVsLastMonthData = useMemo(() => {
    const clientFilteredData = data.filter(
      (d) => selectedClient === "All" || d.client === selectedClient
    );
    if (!clientFilteredData.length) return [];
    const sortedDates = [...clientFilteredData].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
    const lastDate = sortedDates.length > 0 ? dayjs(sortedDates[0].date) : dayjs();
    const lastMonth = lastDate.format("MMM");
    const prevMonth = lastDate.subtract(1, "month").format("MMM");
    const twoMonthsAgo = lastDate.subtract(2, "month").format("MMM");
    const lastThreeMonths = [lastMonth, prevMonth, twoMonthsAgo];
    const last3MonthsData = clientFilteredData.filter((d) =>
      lastThreeMonths.includes(dayjs(d.date).format("MMM"))
    );
    const totalPaid3M = last3MonthsData.reduce((sum, d) => sum + d.paid, 0);
    const totalBilled3M = last3MonthsData.reduce((sum, d) => sum + d.billed, 0);
    const avg3Gcr = totalBilled3M > 0 ? ((totalPaid3M / totalBilled3M) * 100).toFixed(2) : 0;
    const lastMonthAggregated = clientFilteredData
      .filter((d) => dayjs(d.date).format("MMM") === lastMonth)
      .reduce((acc, curr) => ({ paid: acc.paid + curr.paid, billed: acc.billed + curr.billed }), { paid: 0, billed: 0 });
    const lastMonthGcr = lastMonthAggregated.billed > 0 ? ((lastMonthAggregated.paid / lastMonthAggregated.billed) * 100).toFixed(2) : 0;
    return [
      { label: "Last 3 Months GCR", gcr: +avg3Gcr },
      { label: `Last Month (${lastMonth})`, gcr: +lastMonthGcr },
    ];
  }, [data, selectedClient]);

  /** 📌 Payer Breakdown */
  const filteredPayerData = useMemo(() => {
    const filtered = data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" ||
          dayjs(d.date).format("MMM") === selectedMonth)
    );
    return Object.values(
      filtered.reduce((acc, d) => {
        const payer = d.payer || "Unknown";
        if (!acc[payer]) {
          acc[payer] = { name: payer, payments: 0, denied: 0 };
        }
        acc[payer].payments += Number(d.paid || 0);
        acc[payer].denied += Number(d.denied || 0);
        return acc;
      }, {})
    );
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Table Data */
  const filteredTableData = useMemo(() => {
    return data.filter(
      (d) =>
        (selectedClient === "All" || d.client === selectedClient) &&
        (selectedMonth === "All" ||
          dayjs(d.date).format("MMM") === selectedMonth)
    );
  }, [data, selectedClient, selectedMonth]);

  /** 📌 Pagination */
  const totalPages = Math.ceil(filteredTableData.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentData = filteredTableData.slice(indexOfFirstRow, indexOfLastRow);

  const monthsForClient = useMemo(() => ["All", ...allMonths], [allMonths]);

  return (
    <div className="gcr-container">
      <h1 className="gcr-title">Gross Collection Rate (GCR) Dashboard</h1>

      <div className="summary-filters">
        <div className="summary-boxes">
          {/* ✅ KPI Boxes updated with new structure and styling for positioning */}
          <div className="summary-box" style={{ position: "relative" }}>
            <h4>Overall GCR</h4>
            <p>{kpiMetrics.overallGcr}%</p>
            <TrendIndicator trendInfo={kpiMetrics.gcrTrend} />
          </div>
          <div className="summary-box" style={{ position: "relative" }}>
            <h4>Total Payment</h4>
            <p>${kpiMetrics.totalPaid.toLocaleString()}</p>
            <TrendIndicator trendInfo={kpiMetrics.paidTrend} />
          </div>
          <div className="summary-box" style={{ position: "relative" }}>
            <h4>Total Billed</h4>
            <p>${kpiMetrics.totalBilled.toLocaleString()}</p>
            <TrendIndicator trendInfo={kpiMetrics.billedTrend} />
          </div>
        </div>

        <div className="filters">
            {/* Filters remain unchanged */}
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

      {/* --- Charts and Table sections remain unchanged --- */}
      <div className="charts">
        <div className="chart-card">
          <h3>Monthly GCR Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#111" />
              <YAxis stroke="#111" tickFormatter={(tick) => `${tick}%`} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#10b981" name="Actual GCR"/>
              <Line type="monotone" dataKey="target" stroke="#f43f5e" name="Target GCR"/>
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
              <Bar dataKey="gcr" fill="#5759ce" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Payer Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={filteredPayerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#111" />
              <YAxis dataKey="name" type="category" stroke="#111" width={80} />
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="payments" fill="#10b981" barSize={10} name="Payments ($)"/>
              <Bar dataKey="denied" fill="#ef4444" barSize={10} name="Denied ($)"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="claim-table">
        <div className="claim-table-header">
          <h3>Claim Level Details</h3>
        </div>
        <div className="claim-table-body">
          <table>
            <thead>
              <tr>
                {["Claim ID", "Billed Amount ($)", "Paid Amount ($)", "Adjustment Reason", "Payer"].map((header) => (<th key={header}>{header}</th>))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, index) => (
                <tr key={`${row.id}-${index}`}>
                  <td>{row.id}</td>
                  <td>{row.billed.toLocaleString()}</td>
                  <td>{row.paid.toLocaleString()}</td>
                  <td>{row.reason}</td>
                  <td>{row.payer}</td>
              
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>&lt;</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const pageNumber = startPage + i;
            return (
              <button key={pageNumber} onClick={() => setCurrentPage(pageNumber)} className={currentPage === pageNumber ? "active" : ""}>
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