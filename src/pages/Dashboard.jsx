import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import dayjs from "dayjs";
import { ReferenceLine } from "recharts";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import Avatar from "../components/ui/avatar";
import sampleCsv from "../../public/sample-data.csv";
// Parse CSV utility
const parseCSV = async (filePath) => {
  const res = await fetch(filePath);
  const text = await res.text();
  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
    });
  });
};

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState("3m");
  const [pieData, setPieData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("GCR");

  useEffect(() => {
    parseCSV("/sample-data.csv").then((data) => {
      const normalized = data
        .map((r, i) => ({
          id: i + 1,
          date: r.date || r.Date || "",
          billed: Number(r.billed || 0),
          paid: Number(r.paid || 0),
          amount: Number(r.amount || r.payment || 0),
          claim_status: r.claim_status || r.status || "paid",
          patient: r.patient || r.name || "Unknown",
          aging: Number(r.aging || 0),
          is_clean_claim: Number(r.is_clean_claim || 0),
          charge_date: r.charge_date || null,
          billing_date: r.billing_date || null,
          adjusted_billed: r.adjusted_billed || r.billed,
          targetgcr: Number(r.targetgcr || 0),
          baselinegcr: Number(r.baselinegcr || 0),
          targetncr: Number(r.targetncr || 0),
          baselinencr: Number(r.baselinencr || 0),
          targetccr: Number(r.targetccr || 0),
          baselineccr: Number(r.baselineccr || 0),
          targetfpr: Number(r.targetfpr || 0),
          baselinefpr: Number(r.baselinefpr || 0),
        }))
        .filter((r) => r.date);
      setRows(normalized);

      // For pie chart: group by claim_status
      const statusCounts = data.reduce((acc, r) => {
        const status = r.claim_status || r.status || "Other";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const formatted = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
      }));
      setPieData(formatted);
    });
  }, []);

  // Filter rows by selected months
  const filteredData = useMemo(() => {
    let months = 3;
    if (range === "1m") months = 1;
    if (range === "6m") months = 6;
    if (range === "12m") months = 12;

    const cutoff = dayjs().subtract(months, "month");
    return rows.filter((r) => dayjs(r.date).isAfter(cutoff));
  }, [rows, range]);

  // Previous period data for trend calculation
  const prevData = useMemo(() => {
    let months = 3;
    if (range === "1m") months = 1;
    if (range === "6m") months = 6;
    if (range === "12m") months = 12;

    const cutoff = dayjs().subtract(months * 2, "month");
    const currentCutoff = dayjs().subtract(months, "month");
    return rows.filter(
      (r) => dayjs(r.date).isAfter(cutoff) && dayjs(r.date).isBefore(currentCutoff)
    );
  }, [rows, range]);

  // KPI calculation function
  const calculateKPIs = (data) => {
    const totalPayments = data.reduce((sum, r) => sum + r.paid, 0);
    const totalBilled = data.reduce((sum, r) => sum + r.billed, 0);
    const totalClaims = data.length;
    const deniedClaims = data.filter((r) => r.claim_status.toLowerCase() === "denied").length;

    const gcr = totalBilled === 0 ? 0 : ((totalPayments / totalBilled) * 100).toFixed(2);
    const totalAdjustedBilled = data.reduce(
      (sum, r) => sum + (r.adjusted_billed !== undefined ? Number(r.adjusted_billed) : r.billed),
      0
    );
    const ncr = totalAdjustedBilled === 0 ? 0 : ((totalPayments / totalAdjustedBilled) * 100).toFixed(2);
    const denialRate = totalClaims === 0 ? 0 : ((deniedClaims / totalClaims) * 100).toFixed(2);
    const fullyPaidClaims = data.filter((r) => r.claim_status.toLowerCase() === "paid").length;
    const firstPassRate = totalClaims === 0 ? 0 : ((fullyPaidClaims / totalClaims) * 100).toFixed(2);
    const cleanClaims = data.filter((r) => r.is_clean_claim === 1).length;
    const cleanClaimRate = totalClaims === 0 ? 0 : ((cleanClaims / totalClaims) * 100).toFixed(2);

    return {
      totalPayments,
      totalBilled,
      totalClaims,
      gcr,
      ncr,
      denialRate,
      firstPassRate,
      cleanClaimRate,
    };
  };

  const currentKPIs = calculateKPIs(filteredData);
  const prevKPIs = calculateKPIs(prevData);

  

  // Trend calculation
  const trend = (current, previous) => {
    const diff = current - previous;
    const percentChange = previous === 0 ? current : ((diff / previous) * 100).toFixed(2);
    const arrow = diff >= 0 ? "▲" : "▼";
    const color = diff >= 0 ? "green" : "red";
    return { percentChange, arrow, color };
  };

  const kpisWithTrend = {
    gcr: trend(Number(currentKPIs.gcr), Number(prevKPIs.gcr)),
    ncr: trend(Number(currentKPIs.ncr), Number(prevKPIs.ncr)),
    denialRate: trend(Number(currentKPIs.denialRate), Number(prevKPIs.denialRate)),
    firstPassRate: trend(Number(currentKPIs.firstPassRate), Number(prevKPIs.firstPassRate)),
    cleanClaimRate: trend(Number(currentKPIs.cleanClaimRate), Number(prevKPIs.cleanClaimRate)),
    totalClaims: trend(Number(currentKPIs.totalClaims), Number(prevKPIs.totalClaims)),
  };

  // Charge Lag
  const chargeLag = (() => {
    const diffs = filteredData
      .filter((r) => r.charge_date)
      .map((r) => dayjs().diff(dayjs(r.charge_date), "day"));
    if (diffs.length === 0) return "N/A";
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  })();

  // Billing Lag
  const billingLag = (() => {
    const diffs = filteredData
      .filter((r) => r.charge_date && r.billing_date)
      .map((r) => dayjs(r.billing_date).diff(dayjs(r.charge_date), "day"));
    if (diffs.length === 0) return "N/A";
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  })();

  // Avg AR Days
const totalAgingAmount = filteredData.reduce((sum, r) => {
  const outstanding = r.billed - r.paid;
  if (outstanding <= 0) return sum; // ignore fully paid
  const agingDays = r.charge_date ? dayjs().diff(dayjs(r.charge_date), "day") : 0;
  return sum + agingDays * outstanding;
}, 0);

const totalOutstanding = filteredData.reduce(
  (sum, r) => sum + Math.max(r.billed - r.paid, 0),
  0
);

const avgArDays = totalOutstanding === 0 ? 0 : Math.round(totalAgingAmount / totalOutstanding);



  // Payments chart
  // Payments chart with main + target + baseline
  // Payments chart with target & baseline lines from CSV
  // Payments chart with target/baseline from CSV
  const paymentsByMetric = useMemo(() => {
    const map = {};

    filteredData.forEach((r) => {
      const month = dayjs(r.date).format("MMM YY");
      if (!map[month]) map[month] = { sum: 0, count: 0, target: 0, baseline: 0 };

      const paid = Number(r.paid || 0);
      const billed = Number(r.billed || 0);
      const adjusted = Number(r.adjusted_billed || billed);

      if (selectedMetric === "GCR" && billed > 0) map[month].sum += (paid / billed) * 100;
      if (selectedMetric === "NCR" && adjusted > 0) map[month].sum += (paid / adjusted) * 100;
      if (selectedMetric === "CCR") map[month].sum += r.is_clean_claim === 1 ? 100 : 0;
      if (selectedMetric === "FPR") map[month].sum += r.claim_status?.toLowerCase() === "paid" ? 100 : 0;

      // Count every row considered
      map[month].count++;

      // First non-zero target/baseline
      if (!map[month].target) {
        if (selectedMetric === "GCR") map[month].target = Number(r.targetgcr || 0);
        if (selectedMetric === "NCR") map[month].target = Number(r.targetncr || 0);
        if (selectedMetric === "CCR") map[month].target = Number(r.targetccr || 0);
        if (selectedMetric === "FPR") map[month].target = Number(r.targetfpr || 0);
      }
      if (!map[month].baseline) {
        if (selectedMetric === "GCR") map[month].baseline = Number(r.baselinegcr || 0);
        if (selectedMetric === "NCR") map[month].baseline = Number(r.baselinencr || 0);
        if (selectedMetric === "CCR") map[month].baseline = Number(r.baselineccr || 0);
        if (selectedMetric === "FPR") map[month].baseline = Number(r.baselinefpr || 0);
      }
    });

    return Object.entries(map)
      .sort((a, b) => dayjs(a[0], "MMM YYYY").toDate() - dayjs(b[0], "MMM YYYY").toDate())
      .map(([month, obj]) => ({
        month,
        avg: obj.count > 0 ? +(obj.sum / obj.count).toFixed(2) : 0,
        target: obj.target,
        baseline: obj.baseline,
      }));
  }, [filteredData, selectedMetric]);









  // AR days trend (group by MONTH and average aging)
  const arDaysTrend = useMemo(() => {
    const map = {};
    filteredData.forEach((r) => {
      if (!r.date || r.aging === undefined || r.aging === null) return;

      const dateObj = dayjs(r.date);
      const label = dateObj.format("MMM YY");

      if (!map[label]) map[label] = { sum: 0, count: 0, dateObj };
      map[label].sum += Number(r.aging);
      map[label].count += 1;
    });

    return Object.values(map)
      .sort((a, b) => a.dateObj.toDate() - b.dateObj.toDate())
      .map((obj) => ({
        month: obj.dateObj.format("MMM YY"),
        value: Math.round(obj.sum / obj.count),
      }));
  }, [filteredData]);

  const COLORS = ["#00C49F", "#0088FE", "#00BCD4", "#8884D8", "#A9A9A9"];

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="logo">Jorie</div>
          <div>
            <h2 style={{ margin: 0 }}>RCM Dashboard UI</h2>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Reactive billing & collections
            </div>
          </div>
        </div>

        {/* Range Filter */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="filter-select">
            <option value="1m">Last 1 Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <Avatar initials="JD" />
        </div>
      </div>

      {/* KPI Cards with Trends */}
      <div className="kpis">
        {[
          { title: "Gross Collection Rate (GCR)", value: currentKPIs.gcr, trend: kpisWithTrend.gcr, link: "/gcr" },
          { title: "Net Collection Rate (NCR)", value: currentKPIs.ncr, trend: kpisWithTrend.ncr, link: "/ncr" },
          { title: "Denial Rate", value: currentKPIs.denialRate, trend: kpisWithTrend.denialRate, link: "/denial" },
          { title: "First Pass Rate (FPR)", value: currentKPIs.firstPassRate, trend: kpisWithTrend.firstPassRate, link: "/fpr" },
          { title: "Clean Claim Rate (CCR)", value: currentKPIs.cleanClaimRate, trend: kpisWithTrend.cleanClaimRate, link: "/Ccr" },
          { title: "Total Claims", value: currentKPIs.totalClaims.toLocaleString(), trend: kpisWithTrend.totalClaims, link: "/claim" },
        ].map((kpi, i) => (
          <Link key={i} to={kpi.link} style={{ textDecoration: "none", color: "inherit" }}>
            <Card className="clickable" style={{ position: "relative", paddingBottom: 24 }}>
              <h3>{kpi.title}</h3>
              <div className="value">{kpi.value}</div>
              {/* Trend positioned at bottom-right */}
              <div style={{
                position: "absolute",
                bottom: 8,
                right: 12,
                fontWeight: "bold",
                color: kpi.trend.color,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
              }}>
                <span style={{ fontSize: 22 }}>{kpi.trend.arrow}</span>
                <span>{kpi.trend.percentChange}%</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Payments Chart + AR/Claim KPIs */}
      <div className="grid">
        <div>
          <Card className="chart">
            {/* Filter Buttons */}
            <div style={{ marginBottom: 12, display: "flex", gap: "10px" }}>
              {["GCR", "NCR", "CCR", "FPR"].map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: selectedMetric === metric ? "#06b6d4" : "#e5e7eb",
                    color: selectedMetric === metric ? "white" : "black",
                  }}
                >
                  {metric}
                </button>
              ))}
            </div>

            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paymentsByMetric}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="5 5" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v.toFixed(2)}%`} />
                  <Legend />
                  {/* Main metric line */}
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, stroke: "#06b6d4", strokeWidth: 2 }}
                  />

                  <Line
                    type="monotone"
                    dataKey={"target"}
                    stroke="red"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey={"baseline"}
                    stroke="green"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />

                </LineChart>
              </ResponsiveContainer>
            </div>


            <div className="cards-section">
<div className="cards-section">
  <h4 style={{ margin: "65px 0" }}></h4>
  <div className="cards-grid">
    {/* AR Days — Trend */}
    <div className="claim-card" style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 6 }}>AR Days — Trend </h3>
      <div
        className="value"
        style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}
      >
        {avgArDays} Days
      </div>
      <div style={{ width: "100%", height: 165 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData
              .filter((r) => r.charge_date && r.billed - r.paid > 0)
              .map((r) => ({
                month: dayjs(r.charge_date).format("MMM YY"),
                value: Math.round(
                  dayjs().diff(dayjs(r.charge_date), "day")
                ),
              }))}
            margin={{ top: 20, right: 30, left: -30, bottom: 0 }}
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="5 5" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
            <Tooltip
              formatter={(value) => `${value} days`}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
                {/* AR + 90 Days with Pie Chart */}
                <div className="claim-card" style={{ padding: 12 }}>
                  <h3>AR + 90 Days</h3>
                  <div className="value">{currentKPIs.totalClaims.toLocaleString()}</div>
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 0 }}>
                    <PieChart width={200} height={180}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </div>
                </div>
              </div>
            </div></div>
          </Card>
        </div>
        {/* 3 BOXESS  */}
        <div className="kpis2">
          {[
            {
              title: "Charge Lag",
              value: chargeLag === "N/A" ? 0 : chargeLag,
              previous: (() => {
                const diffs = prevData
                  .filter((r) => r.charge_date)
                  .map((r) => dayjs().diff(dayjs(r.charge_date), "day"));
                if (diffs.length === 0) return 0;
                return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
              })(),
              color: "#38BDF8", // blue
              suffix: " days",
            },
            {
              title: "Billing Lag",
              value: billingLag === "N/A" ? 0 : billingLag,
              previous: (() => {
                const diffs = prevData
                  .filter((r) => r.charge_date && r.billing_date)
                  .map((r) => dayjs(r.billing_date).diff(dayjs(r.charge_date), "day"));
                if (diffs.length === 0) return 0;
                return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
              })(),
              color: "#A78BFA", // purple
              suffix: " days",
            },
            {
              title: "Total Payments",
              value: currentKPIs.totalPayments,
              previous: prevKPIs.totalPayments,
              color: "#4ADE80", // green
              prefix: "$",
            },
          ].map((card, idx) => {
            const diff = card.value - card.previous;
            const percentChange =
              card.previous === 0 ? card.value : ((diff / card.previous) * 100).toFixed(2);
            const isIncrease = diff >= 0;

            // Mini chart data (last 6 months)
            const miniChartData = filteredData.slice(-7).map((r) => r.paid || r.aging || 0);

            return (
              <Card
                key={idx}
                style={{
                  flex: 1,
                  minHeight: 120,
                  padding: "12px 16px",
                  borderRadius: "10px",
                  position: "relative",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                {/* Top section */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#666" }}>
                    {card.title}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 2,
                    }}
                  >
                    {card.prefix || ""}
                    {card.value.toLocaleString()}
                    {card.suffix || ""}
                    <span
                      style={{
                        color: isIncrease ? "#16A34A" : "#DC2626",
                        fontSize: 13,
                        fontWeight: "bold",
                      }}
                    >
                      {isIncrease ? "▲" : "▼"} {percentChange}%
                    </span>
                  </div>
                </div>

                {/* Mini bar chart */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    height: card.title === "Charge Lag" ? 70 : card.title === "Billing Lag" ? 65 : 85,
                    // 👈 custom height
                    position: card.title === "Total Payments" ? "absolute" : "relative", // 👈 only for Total Payments
                    bottom: card.title === "Total Payments" ? 10 : "auto",
                    right: card.title === "Total Payments" ? -75 : "auto",
                    width: card.title === "Total Payments" ? "90%" : "100%", // 👈 shrink width for right-corner
                    alignItems: "flex-end",
                  }}
                >
                  {miniChartData.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        height: `${(v / Math.max(...miniChartData)) * 100}%`,
                        backgroundColor: card.color,
                        flex:
                          card.title === "Total Payments"
                            ? 0.1111 // 👈 thinner bars for Total Payments
                            : 1,
                        borderRadius: 2,

                        transition: "height 0.3s",
                      }}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>



      </div>

      {/* Bottom Section */}
      <div className="kpis3">
        <Card>
          <h3>Top Providers</h3>
          <div className="small-list">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Provider A</div>
              <div>₹{(currentKPIs.totalPayments * 0.3).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Provider B</div>
              <div>₹{(currentKPIs.totalPayments * 0.18).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Provider C</div>
              <div>₹{(currentKPIs.totalPayments * 0.12).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button>View all providers</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
