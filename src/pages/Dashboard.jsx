import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import dayjs from "dayjs";
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  LabelList
} from "recharts";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import Avatar from "../components/ui/avatar";

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
  const [selectedMetric, setSelectedMetric] = useState("GCR");

  useEffect(() => {
    parseCSV("/sample-data.csv").then((data) => {
      const normalized = data
        .map((r) => ({
          date: r.date || r.Date || "",
          billed: Number(r.billed || 0),
          paid: Number(r.paid || 0),
          claim_status: r.claim_status || r.status || "paid",
          is_clean_claim: Number(r.is_clean_claim || 0),
          charge_date: r.charge_date || null,
          billing_date: r.billing_date || null,
          adjusted_billed: r.adjusted_billed !== undefined ? Number(r.adjusted_billed) : Number(r.billed || 0),
          targetgcr: Number(r.targetgcr || 0),
          baselinegcr: Number(r.baselinegcr || 0),
          targetncr: Number(r.targetncr || 0),
          baselinencr: Number(r.baselinencr || 0),
          targetccr: Number(r.targetccr || 0),
          baselineccr: Number(r.baselineccr || 0),
          targetfpr: Number(r.targetfpr || 0),
          baselinefpr: Number(r.baselinefpr || 0),
          targetdenialrate: Number(r.targetdenialrate || 0),
          baselinedenialrate: Number(r.baselinedenialrate || 0),
          aging: r.charge_date ? dayjs().diff(dayjs(r.charge_date), 'day') : 0,
        }))
        .filter((r) => r.date);
      setRows(normalized);
    });
  }, []);

  const { filteredData, prevData } = useMemo(() => {
    let months = 3;
    if (range === "1m") months = 1;
    if (range === "6m") months = 6;
    if (range === "12m") months = 12;
    const currentCutoff = dayjs().subtract(months, "month");
    const prevCutoff = dayjs().subtract(months * 2, "month");
    const currentPeriodData = rows.filter((r) => dayjs(r.date).isAfter(currentCutoff));
    const previousPeriodData = rows.filter((r) => dayjs(r.date).isAfter(prevCutoff) && dayjs(r.date).isBefore(currentCutoff));
    return { filteredData: currentPeriodData, prevData: previousPeriodData };
  }, [rows, range]);

  const calculateKPIs = (data) => {
    if (data.length === 0) {
      return { totalPayments: 0, totalClaims: 0, gcr: 0, ncr: 0, denialRate: 0, firstPassRate: 0, cleanClaimRate: 0, totalDenials: 0 };
    }
    const totalPayments = data.reduce((sum, r) => sum + r.paid, 0);
    const totalBilled = data.reduce((sum, r) => sum + r.billed, 0);
    const totalAdjustedBilled = data.reduce((sum, r) => sum + (r.adjusted_billed !== undefined ? Number(r.adjusted_billed) : r.billed), 0);
    const totalClaims = data.length;
    const deniedClaims = data.filter((r) => r.claim_status.toLowerCase() === "denied").length;
    const gcr = totalBilled === 0 ? 0 : (totalPayments / totalBilled) * 100;
    const ncr = totalAdjustedBilled === 0 ? 0 : (totalPayments / totalAdjustedBilled) * 100;
    const denialRate = totalClaims === 0 ? 0 : (deniedClaims / totalClaims) * 100;
    const firstPassRate = totalClaims === 0 ? 0 : (data.filter(r => r.claim_status.toLowerCase() === 'paid').length / totalClaims) * 100;
    const cleanClaimRate = totalClaims === 0 ? 0 : (data.filter(r => r.is_clean_claim === 1).length / totalClaims) * 100;
    const totalDenials = deniedClaims;
    return { totalPayments, totalClaims, gcr, ncr, denialRate, firstPassRate, cleanClaimRate, totalDenials };
  };

  const currentKPIs = calculateKPIs(filteredData);
  const prevKPIs = calculateKPIs(prevData);

  const trend = (current, previous, isIncreaseGood = true) => {
    if (previous === 0) return { percentChange: current > 0 ? "100" : "0", arrow: "▲", color: "#6c757d" };
    const diff = current - previous;
    const percentChange = (diff / previous) * 100;
    const isPositive = percentChange >= 0;
    return {
      percentChange: Math.abs(percentChange).toFixed(2),
      arrow: isPositive ? "▲" : "▼",
      color: (isPositive === isIncreaseGood) ? "#198754" : "#dc3545",
    };
  };

  const kpisWithTrend = {
    gcr: trend(currentKPIs.gcr, prevKPIs.gcr, true),
    ncr: trend(currentKPIs.ncr, prevKPIs.ncr, true),
    denialRate: trend(currentKPIs.denialRate, prevKPIs.denialRate, true),
    firstPassRate: trend(currentKPIs.firstPassRate, prevKPIs.firstPassRate, true),
    cleanClaimRate: trend(currentKPIs.cleanClaimRate, prevKPIs.cleanClaimRate, true),
    totalClaims: trend(currentKPIs.totalClaims, prevKPIs.totalClaims, true),
  };

  const getSparklineData = (key) => filteredData.slice(-30).map(r => ({ value: r[key] || 0 }));
  const kpiSparklines = {
    gcr: getSparklineData('paid'),
    ncr: getSparklineData('paid'),
    firstPassRate: getSparklineData('paid'),
    cleanClaimRate: getSparklineData('is_clean_claim'),
    totalClaims: getSparklineData('billed'),
    denialRate: Object.values(
      filteredData.slice(-30).reduce((acc, r) => {
        const day = dayjs(r.date).format("YYYY-MM-DD");
        if (!acc[day]) acc[day] = { denied: 0, total: 0, date: day };
        acc[day].total++;
        if (r.claim_status?.toLowerCase() === "denied") acc[day].denied++;
        return acc;
      }, {})
    ).map(d => ({
      value: d.total > 0 ? (d.denied / d.total) * 100 : 0, // percentage
    })),

  };

  const calculateLag = (data, dateKey1, dateKey2) => {
    const diffs = data
      .filter(r => r[dateKey1] && (dateKey2 ? r[dateKey2] : true))
      .map(r => dayjs(dateKey2 ? r[dateKey2] : undefined).diff(dayjs(r[dateKey1]), 'day'));
    return diffs.length === 0 ? 0 : Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  };
  const chargeLag = calculateLag(filteredData, 'charge_date');
  const billingLag = calculateLag(filteredData, 'billing_date');

  const mainChartData = useMemo(() => {
    const map = {};
    filteredData.forEach((r) => {
      const month = dayjs(r.date).format("MMM");
      if (!map[month]) map[month] = { sum: 0, count: 0, target: 0, baseline: 0, date: dayjs(r.date).startOf('month') };
      const { paid, billed, adjusted_billed, is_clean_claim, claim_status } = r;
      if (selectedMetric === "GCR" && billed > 0) map[month].sum += (paid / billed);
      else if (selectedMetric === "NCR" && adjusted_billed > 0) map[month].sum += (paid / adjusted_billed);
      else if (selectedMetric === "CCR") map[month].sum += is_clean_claim;
      else if (selectedMetric === "FPR") map[month].sum += (claim_status?.toLowerCase() === "paid" ? 1 : 0);
      else if (selectedMetric === "Denial Rate") map[month].sum += (claim_status?.toLowerCase() === "denied" ? 1 : 0);
      map[month].count++;
      const metricKey = selectedMetric.replace(' ', '').toLowerCase();
      if (!map[month].target) map[month].target = r[`target${metricKey}`] || 0;
      if (!map[month].baseline) map[month].baseline = r[`baseline${metricKey}`] || 0;
    });
    return Object.values(map)
      .sort((a, b) => a.date.unix() - b.date.unix())
      .map(obj => ({
        month: obj.date.format('MMM YY'),
        avg: obj.count > 0 ? +(obj.sum / obj.count * 100).toFixed(2) : 0,
        target: obj.target,
        baseline: obj.baseline,
      }));
  }, [filteredData, selectedMetric]);

  const avgArDays = filteredData.length > 0 ? Math.round(filteredData.reduce((sum, r) => sum + r.aging, 0) / filteredData.length) : 0;

  const arDaysTrendData = useMemo(() => {
    const monthlyData = {};
    filteredData.forEach(item => {
      const month = dayjs(item.date).format('MMM YY');
      if (!monthlyData[month]) monthlyData[month] = { sum: 0, count: 0, date: dayjs(item.date).startOf('month') };
      monthlyData[month].sum += item.aging;
      monthlyData[month].count++;
    });
    return Object.values(monthlyData)
      .sort((a, b) => a.date.unix() - b.date.unix())
      .map(monthData => ({
        month: monthData.date.format('MMM YY'),
        value: Math.round(monthData.sum / monthData.count),
      }));
  }, [filteredData]);

  const arAgingPieData = useMemo(() => {
    const buckets = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0 };
    filteredData.forEach(item => {
      const aging = item.aging;
      if (aging <= 30) buckets['0-30 Days']++;
      else if (aging <= 60) buckets['31-60 Days']++;
      else if (aging <= 90) buckets['61-90 Days']++;
      else buckets['90+ Days']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const pyramidChartData = useMemo(() => {
    const data = [
      { name: 'GCR', current: currentKPIs.gcr, previous: prevKPIs.gcr },
      { name: 'NCR', current: currentKPIs.ncr, previous: prevKPIs.ncr },
      { name: 'CCR', current: currentKPIs.cleanClaimRate, previous: prevKPIs.cleanClaimRate },
      { name: 'FPR', current: currentKPIs.firstPassRate, previous: prevKPIs.firstPassRate },
      { name: 'Total Claims', current: 100 - currentKPIs.cleanClaimRate, previous: 100 - prevKPIs.cleanClaimRate },
      { name: 'Denial Rate', current: currentKPIs.denialRate, previous: prevKPIs.denialRate },
    ];
    return data.map(item => ({ name: item.name, current: item.current, previous: -item.previous }));
  }, [currentKPIs, prevKPIs]);

  const sideCardSparklines = useMemo(() => {
    const dailyData = {};
    const dataWindow = filteredData.slice(-7);
    dataWindow.forEach(r => {
      const day = dayjs(r.date).format('YYYY-MM-DD');
      if (!dailyData[day]) {
        dailyData[day] = { payments: 0, chargeLags: [], billingLags: [] };
      }
      dailyData[day].payments += r.paid;
      if (r.charge_date) dailyData[day].chargeLags.push(dayjs().diff(dayjs(r.charge_date), 'day'));
      if (r.billing_date && r.charge_date) dailyData[day].billingLags.push(dayjs(r.billing_date).diff(dayjs(r.charge_date), 'day'));
    });
    const sortedDays = Object.keys(dailyData).sort();
    const paymentsData = sortedDays.map(day => ({ value: dailyData[day].payments }));
    const chargeLagData = sortedDays.map(day => {
      const lags = dailyData[day].chargeLags;
      const avgLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0;
      return { value: avgLag };
    });
    const billingLagData = sortedDays.map(day => {
      const lags = dailyData[day].billingLags;
      const avgLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0;
      return { value: avgLag };
    });
    return { paymentsData, chargeLagData, billingLagData };
  }, [filteredData]);

  const CustomPyramidTooltip = ({ active, payload, label }) => { /* ... unchanged ... */ };
  const formatPyramidTick = (value) => `${Math.abs(value).toFixed(0)}%`;

  const sideCardData = [
    { title: 'Charge Lag', value: chargeLag, trend: trend(chargeLag, calculateLag(prevData, 'charge_date'), true), color: '#3b82f6', suffix: 'days', sparklineData: sideCardSparklines.chargeLagData },
    { title: 'Billing Lag', value: billingLag, trend: trend(billingLag, calculateLag(prevData, 'charge_date', 'billing_date'), true), color: '#8b5cf6', suffix: 'days', sparklineData: sideCardSparklines.billingLagData },
    { title: 'Total Payments', value: currentKPIs.totalPayments, trend: trend(currentKPIs.totalPayments, prevKPIs.totalPayments, true), color: '#22c55e', prefix: '$', sparklineData: sideCardSparklines.paymentsData },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f3f4f6', fontFamily: 'system-ui, sans-serif', marginTop: '-10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: '#7c3aed', color: 'white', width: '40px', height: '40px', borderRadius: '8px', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '18px' }}>J</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>RCM Dashboard UI</h2>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>Reactive billing & collections</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: 'white' }}>
            <option value="1m">Last 1 Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <Avatar initials="JD" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
        {[
          { title: "Gross Collection Rate (GCR)", value: currentKPIs.gcr.toFixed(2), trend: kpisWithTrend.gcr, sparklineData: kpiSparklines.gcr, link: "/gcr" },
          { title: "Net Collection Rate (NCR)", value: currentKPIs.ncr.toFixed(2), trend: kpisWithTrend.ncr, sparklineData: kpiSparklines.ncr, link: "/ncr" },
          { title: "Denial Rate", value: currentKPIs.denialRate.toFixed(2), trend: kpisWithTrend.denialRate, sparklineData: kpiSparklines.denialRate, link: "/denials" },
          { title: "First Pass Rate (FPR)", value: currentKPIs.firstPassRate.toFixed(2), trend: kpisWithTrend.firstPassRate, sparklineData: kpiSparklines.firstPassRate, link: "/fpr" },
          { title: "Clean Claim Rate (CCR)", value: currentKPIs.cleanClaimRate.toFixed(2), trend: trend(currentKPIs.cleanClaimRate, prevKPIs.cleanClaimRate, true), sparklineData: kpiSparklines.cleanClaimRate, link: "/ccr" },
          { title: "Total Claims", value: currentKPIs.totalClaims.toLocaleString(), trend: kpisWithTrend.totalClaims, sparklineData: kpiSparklines.totalClaims, link: "/claims" },
        ].map((kpi) => (
          <Link to={kpi.link} key={kpi.title} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card
              className="kpi-card"
              style={{
                padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', height: '100%', transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'pointer'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#6c757d', fontWeight: 500 }}>{kpi.title.replace(/\s\(.*\)/, '')}</h3>
                <p style={{ margin: '8px 0', fontSize: '32px', fontWeight: 'bold' }}>{kpi.value}{kpi.title.includes('Rate') || kpi.title.includes('GCR') ? '%' : ''}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ color: kpi.trend.color, fontWeight: 'bold' }}>{kpi.trend.arrow} {kpi.trend.percentChange}%</div>
                <div style={{ width: '80px', height: '30px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.sparklineData}>
                      <Area type="monotone" dataKey="value" stroke={kpi.trend.color} fill={`${kpi.trend.color}33`} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <Card style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {["GCR", "NCR", "Denial Rate", "CCR", "FPR"].map(metric => (
                <button key={metric} onClick={() => setSelectedMetric(metric)} style={{ padding: '6px 12px', borderRadius: '16px', border: '1px solid #dee2e6', cursor: 'pointer', backgroundColor: selectedMetric === metric ? '#e0e0e0' : 'transparent', color: 'black', fontWeight: 500 }}>{metric}</button>
              ))}
            </div>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mainChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v.toFixed(2)}%`} />
                  <Legend iconType="plainline" />
                  <Line type="monotone" name="avg" dataKey="avg" stroke="#00C49F" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="target" dataKey="target" stroke="#FF8042" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                  <Line type="monotone" name="baseline" dataKey="baseline" stroke="#FF0000" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              {sideCardData.slice(0, 2).map(card => (
                <Card key={card.title} style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#6c757d' }}>{card.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', margin: '8px 0' }}>
                      <span>{card.prefix || ''}{card.value.toLocaleString()}{card.suffix ? ` ${card.suffix}` : ''}</span>
                      <span style={{ fontSize: '13px', color: card.trend.color, fontWeight: 'bold' }}>{card.trend.arrow} {card.trend.percentChange}%</span>
                    </div>
                  </div>
                  <div style={{ height: '50px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={card.sparklineData}>
                        <Tooltip contentStyle={{ fontSize: '12px', padding: '2px 5px' }} cursor={{ fill: '#fafafa' }} />
                        <Bar dataKey="value" fill={card.color} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              ))}
            </div>
            {sideCardData.slice(2).map(card => (
              <Card key={card.title} style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#6c757d' }}>{card.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', margin: '8px 0' }}>
                    <span>{card.prefix || ''}{card.value.toLocaleString()}{card.suffix ? ` ${card.suffix}` : ''}</span>
                    <span style={{ fontSize: '13px', color: card.trend.color, fontWeight: 'bold' }}>{card.trend.arrow} {card.trend.percentChange}%</span>
                  </div>
                </div>
                <div style={{ height: '50px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={card.sparklineData}>
                      <Tooltip contentStyle={{ fontSize: '12px', padding: '2px 5px' }} formatter={(value) => `$${value.toLocaleString()}`} cursor={{ fill: '#fafafa' }} />
                      <Bar dataKey="value" fill={card.color} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <Card style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>AR Days</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '8px 0' }}>{avgArDays} Days</p>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={arDaysTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `${value} Days`} />
                  <Line type="monotone" dataKey="value" name="Avg AR Days" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* *** MODIFIED AR AGING BUCKETS CARD *** */}
          <Card style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6' }}>
            <h3 style={{ margin: 0, fontSize: '16px', textAlign: 'left' }}>AR Aging Buckets</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', width: '100%' }}>
              {/* Pie chart on the left */}
              <div style={{ flex: 1, height: '100%', marginTop: '10%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={arAgingPieData} cx="50%" cy="50%" outerRadius="100%" fill="#8884d8" dataKey="value" labelLine={false}>
                      {arAgingPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} claims`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend on the right */}
              <div style={{ flex: 0.4, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '-20px', marginTop: '15%', gap: '12px' }}>
                {arAgingPieData.map((entry, index) => (
                  <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: PIE_COLORS[index % PIE_COLORS.length], borderRadius: '3px', marginRight: '8px' }}></span>
                    <span style={{ fontSize: '14px', color: '#343a40' }}>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #dee2e6' }}>
            <h3 style={{ margin: 0, fontSize: '16px', textAlign: 'left', marginBottom: '10px' }}>
              Current vs. Previous Period (%)
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#0a0a0aff',
                marginBottom: '10px',
              }}
            >
              <span>Previous</span>
              <span>Current</span>
            </div>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={pyramidChartData}
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[-100, 100]}
                    tickFormatter={(value) => `${Math.abs(value).toFixed(1)}%`} // ✅ always positive labels
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={75}
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    content={<CustomPyramidTooltip />}
                    cursor={{ fill: "rgba(200, 200, 200, 0.2)" }}
                    formatter={(value) => [`${Math.abs(value).toFixed(1)}%`]} // ✅ tooltip positive
                  />

                  {/* ✅ Show positive labels only */}
                  <Bar dataKey="previous" fill="#8b5cf6" barSize={20} name="Previous Period">
                    <LabelList
                      dataKey="previous"
                      position="right"
                      formatter={(val) => `${Math.abs(val).toFixed(1)}%`}
                    />
                  </Bar>
                  <Bar dataKey="current" fill="#0088FE" barSize={20} name="Current Period">
                    <LabelList
                      dataKey="current"
                      position="right"
                      formatter={(val) => `${Math.abs(val).toFixed(1)}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}