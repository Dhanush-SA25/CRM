import { Droppable } from "@hello-pangea/dnd";
import DealCard from "./DealCard";
import { DEAL_STAGE_LABELS, formatCurrency } from "../../utils/formatters";

/** Grayscale header accents keep the board inside the gradient-gray theme. */
const COLUMN_HEADER_COLORS = {
  new:         "bg-slate-900 text-white border-slate-900",
  contacted:   "bg-slate-100 text-slate-700 border-slate-200",
  qualified:   "bg-slate-100 text-slate-700 border-slate-200",
  proposal:    "bg-slate-100 text-slate-700 border-slate-200",
  negotiation: "bg-slate-200 text-slate-800 border-slate-300",
  won:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost:        "bg-red-50 text-red-700 border-red-200",
};

/**
 * KanbanColumn — a droppable column that lists DealCards for one pipeline stage.
 *
 * Props:
 *   stage    {string}    — one of the VALID_STAGES keys
 *   deals    {object[]}  — deals belonging to this stage (already filtered by caller)
 *   onEdit   {function}  — forwarded to each DealCard
 *   onDelete {function}  — forwarded to each DealCard
 */
export default function KanbanColumn({ stage, deals = [], onEdit, onDelete }) {
  const label = DEAL_STAGE_LABELS[stage] ?? stage;
  const headerClass =
    COLUMN_HEADER_COLORS[stage] ?? "bg-gray-100 text-gray-700 border-gray-300";

  // Aggregate column value
  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-surface-border bg-white/60 shadow-sm backdrop-blur">
      {/* Column header */}
      <div
        className={`flex items-center justify-between border-b px-3 py-2.5 ${headerClass}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{label}</span>
          <span className="inline-flex items-center justify-center rounded-full bg-white bg-opacity-70 text-xs font-medium px-1.5 py-0.5 min-w-[20px]">
            {deals.length}
          </span>
        </div>
        {deals.length > 0 && (
          <span className="text-xs font-medium opacity-80">
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              "flex flex-col gap-2 p-2 flex-1 min-h-[120px] transition-colors duration-150",
              snapshot.isDraggingOver ? "bg-slate-100/80" : "bg-transparent",
            ].join(" ")}
          >
            {deals.map((deal, index) => (
              <DealCard
                key={deal.id}
                deal={deal}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {provided.placeholder}

            {/* Empty state hint */}
            {deals.length === 0 && !snapshot.isDraggingOver && (
              <p className="py-4 text-center text-xs text-slate-400">
                No deals
              </p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
