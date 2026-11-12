/**
 * Utility formatters shared across the app.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Format a number as Indian Rupees using Indian digit grouping.
 * Display only — stored numeric values are never converted.
 * @param {number} value
 * @returns {string}  e.g. "₹12,500.00"
 */
export function formatCurrency(value) {
  const numeric = Number(value);
  return inrFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

/**
 * Short INR label for chart axes/tooltips.
 * @param {number} value
 * @returns {string}  e.g. "₹1.2L"
 */
export function formatCompactCurrency(value) {
  const numeric = Number(value);
  return inrCompactFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

/**
 * Format an ISO date string to a readable date.
 * @param {string|Date} date
 * @returns {string}  e.g. "Jun 15, 2024"
 */
export function formatDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Relative time  e.g. "3 days ago"
 * @param {string|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Map a deal stage to a human-readable label.
 * The seven stages form the sales pipeline (in order):
 *   new → contacted → qualified → proposal → negotiation → won / lost
 */
export const DEAL_STAGE_LABELS = {
  new:         "New",
  contacted:   "Contacted",
  qualified:   "Qualified",
  proposal:    "Proposal",
  negotiation: "Negotiation",
  won:         "Won",
  lost:        "Lost",
};

/**
 * Map a lead status to a badge colour.
 */
export const LEAD_STATUS_COLORS = {
  new:       "badge-blue",
  contacted: "badge-yellow",
  qualified: "badge-green",
  lost:      "badge-red",
};

/**
 * Map a customer status to a badge colour.
 */
export const CUSTOMER_STATUS_COLORS = {
  active:   "badge-green",
  inactive: "badge-red",
  prospect: "badge-yellow",
};

/**
 * Map a deal stage to a badge colour.
 * Terminal stages use semantic colours: won = green, lost = red.
 * Progress stages escalate: gray → blue → purple → yellow.
 */
export const DEAL_STAGE_COLORS = {
  new:         "badge-gray",
  contacted:   "badge-blue",
  qualified:   "badge-purple",
  proposal:    "badge-yellow",
  negotiation: "badge-yellow",
  won:         "badge-green",
  lost:        "badge-red",
};

/**
 * Map a follow-up status to a badge colour.
 * `overdue` is a computed status (pending + past due_date), not persisted.
 */
export const FOLLOWUP_STATUS_COLORS = {
  pending:   "badge-yellow",
  completed: "badge-green",
  overdue:   "badge-red",
};

/**
 * Map a task status to a badge colour.
 */
export const TASK_STATUS_COLORS = {
  todo:        "badge-gray",
  in_progress: "badge-blue",
  done:        "badge-green",
};

/**
 * Map a priority to a badge colour.
 */
export const PRIORITY_COLORS = {
  low:    "badge-gray",
  medium: "badge-yellow",
  high:   "badge-red",
};
