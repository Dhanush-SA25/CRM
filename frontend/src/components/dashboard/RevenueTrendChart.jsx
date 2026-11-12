import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "../../utils/formatters";
import ChartEmpty from "./ChartEmpty";

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 16px 40px -20px rgba(17,24,39,0.35)",
  fontSize: 12,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.98)",
};

export default function RevenueTrendChart({ data = [] }) {
  const hasRevenue = data.some((item) => (item.revenue ?? 0) > 0);
  if (!hasRevenue) {
    return <ChartEmpty message="No won revenue in the last 12 months" height={280} />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="revenue"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCompactCurrency}
        />
        <YAxis
          yAxisId="deals"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <RechartsTooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#111827", fontWeight: 600 }}
          formatter={(value, name) =>
            name === "Revenue" ? [formatCurrency(value), name] : [value, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          name="Revenue"
          fill="#111827"
          radius={[6, 6, 0, 0]}
          barSize={22}
        />
        <Line
          yAxisId="deals"
          type="monotone"
          dataKey="deals"
          name="Deals won"
          stroke="#9ca3af"
          strokeWidth={2}
          dot={{ r: 3, fill: "#9ca3af" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
