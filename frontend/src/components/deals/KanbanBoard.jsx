import { DragDropContext } from "@hello-pangea/dnd";
import KanbanColumn from "./KanbanColumn";
import { DEAL_STAGE_LABELS } from "../../utils/formatters";

/** Pipeline order — matches the backend VALID_STAGES list. */
const STAGES = Object.keys(DEAL_STAGE_LABELS);

/**
 * KanbanBoard — renders one droppable column per pipeline stage.
 *
 * Props:
 *   deals        {object[]} — all deals to display
 *   onStageChange {function} — called with (dealId, newStage) after a card is
 *                              dropped in a different column
 *   onEdit       {function} — forwarded to each card
 *   onDelete     {function} — forwarded to each card
 */
export default function KanbanBoard({ deals = [], onStageChange, onEdit, onDelete }) {
  const grouped = Object.fromEntries(STAGES.map((stage) => [stage, []]));
  for (const deal of deals) {
    const bucket = grouped[deal.stage] ?? grouped.new;
    bucket.push(deal);
  }

  function handleDragEnd({ draggableId, source, destination }) {
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const dealId = Number(draggableId);
    if (Number.isNaN(dealId)) return;

    onStageChange?.(dealId, destination.droppableId);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={grouped[stage]}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
