import ProgressBar from "../ui/ProgressBar";
import Tooltip from "../ui/Tooltip";
import { formatCurrency } from "../../utils/formatters";
import ChartEmpty from "./ChartEmpty";

const ROLE_BADGES = {
  admin: "badge-ink",
  manager: "badge-purple",
  sales: "badge-gray",
};

function AttainmentCell({ value }) {
  if (value == null) return <span className="text-xs text-slate-400">No target</span>;
  return (
    <div className="min-w-[96px]">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{value}%</span>
      </div>
      <ProgressBar
        value={Math.min(value, 100)}
        max={100}
        tone={value >= 100 ? "green" : value >= 60 ? "amber" : "red"}
        className="mt-1"
      />
    </div>
  );
}

export default function EmployeePerformanceTable({ rows = [] }) {
  if (!rows.length) {
    return <ChartEmpty message="No employee activity recorded" height={220} />;
  }

  const top = rows[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Top performer:</span>
        <span>{top.name}</span>
        <span className="text-slate-300">·</span>
        <span>{formatCurrency(top.revenue_won)} won</span>
        <span className="text-slate-300">·</span>
        <span>{top.deals_won} deals</span>
      </div>
      <div className="data-table -mx-5 overflow-x-auto">
        <table className="min-w-[860px]">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>
                <span className="inline-flex items-center gap-1">
                  Revenue won <Tooltip label="Sum of won deal values assigned to this employee." />
                </span>
              </th>
              <th>Won</th>
              <th>
                <span className="inline-flex items-center gap-1">
                  Open pipeline <Tooltip label="Value of open deals currently owned by this employee." />
                </span>
              </th>
              <th>Leads</th>
              <th>Activities</th>
              <th>Tasks done</th>
              <th>
                <span className="inline-flex items-center gap-1">
                  Target <Tooltip label="Won revenue against the current quarter target." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id}>
                <td>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{row.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{row.email}</p>
                  </div>
                </td>
                <td>
                  <span className={ROLE_BADGES[row.role] ?? "badge-gray"}>{row.role}</span>
                </td>
                <td className="font-medium text-slate-800">{formatCurrency(row.revenue_won)}</td>
                <td>{row.deals_won}</td>
                <td>{formatCurrency(row.open_pipeline_value)}</td>
                <td>{row.leads}</td>
                <td>{row.activities}</td>
                <td>{row.tasks_completed}</td>
                <td>
                  <AttainmentCell value={row.target_attainment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
