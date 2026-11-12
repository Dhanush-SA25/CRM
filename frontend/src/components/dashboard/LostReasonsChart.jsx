import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../utils/formatters";
import ChartEmpty from "./ChartEmpty";

const COLORS = ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#dc2626"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 16px 40px -20px rgba(17,24,39,0.35)",
  fontSize: 12,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.98)",
};

export default function LostReasonsChart({ data }) {
  const reasons = data?.reasons ?? [];
  const totalLost = data?.total_lost ?? 0;

  if (!reasons.length) {
    return <ChartEmpty message="No lost deals recorded" height={240} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Lost pipeline</p>
          <p className="mt-1 text-[26px] font-bold leading-none text-ink">{totalLost} deals</p>
        </div>
        <p className="text-right text-xs text-slate-500">
          <span className="block font-semibold text-slate-700">
            {formatCurrency(data?.total_lost_value)}
          </span>
          lost value
        </p>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie
            data={reasons}
            dataKey="count"
            nameKey="reason"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={78}
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {reasons.map((entry, index) => (
              <Cell key={entry.reason} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (value || "Unspecified").slice(0, 22)}
            wrapperStyle={{ fontSize: 11, color: "#6b7280" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [`${value} deals`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-1 divide-y divide-slate-100">
        {reasons.slice(0, 4).map((reason) => (
          <li key={reason.reason} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="truncate text-slate-600">{reason.reason}</span>
            <span className="flex-shrink-0 text-slate-400">
              {reason.count} · {reason.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
