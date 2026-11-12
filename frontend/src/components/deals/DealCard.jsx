import { Draggable } from "@hello-pangea/dnd";
import { Pencil, Trash2, Calendar, TrendingUp } from "lucide-react";
import Badge from "../ui/Badge";
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from "../../utils/formatters";
import { formatCurrency, formatDate } from "../../utils/formatters";

/**
 * DealCard — a draggable card representing a single deal.
 *
 * Props:
 *   deal    {object}   — the deal data object
 *   index   {number}   — position in the droppable list (required by @hello-pangea/dnd)
 *   onEdit  {function} — called with the deal when the edit button is clicked
 *   onDelete {function}— called with the deal when the delete button is clicked
 */
export default function DealCard({ deal, index, onEdit, onDelete }) {
  const stageLabel = DEAL_STAGE_LABELS[deal.stage] ?? deal.stage;
  const stageBadge = DEAL_STAGE_COLORS[deal.stage] ?? "badge-gray";

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={[
            "rounded-xl border border-surface-border bg-white p-3 shadow-sm",
            "cursor-grab active:cursor-grabbing select-none",
            "transition-all duration-150",
            snapshot.isDragging
              ? "rotate-1 shadow-xl ring-2 ring-slate-900/20"
              : "hover:border-slate-300 hover:shadow-card-hover",
          ].join(" ")}
        >
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">
              {deal.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(deal);
                }}
                aria-label={`Edit ${deal.title}`}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(deal);
                }}
                aria-label={`Delete ${deal.title}`}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Stage badge */}
          <div className="mb-2">
            <Badge className={stageBadge}>{stageLabel}</Badge>
          </div>

          {/* Value */}
          <p className="text-base font-bold text-gray-900 mb-2">
            {formatCurrency(deal.value)}
          </p>

          {/* Probability and close date */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            {deal.probability != null && (
              <span className="flex items-center gap-1">
                <TrendingUp size={11} />
                {deal.probability}%
              </span>
            )}
            {deal.close_date && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(deal.close_date)}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
