import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import KanbanBoard from "../KanbanBoard";

/**
 * Drag-and-drop is hard to reproduce faithfully in jsdom (the real sensor
 * relies on layout measurements), so the dnd primitives are stubbed. The
 * stub captures the board's `onDragEnd` handler, which lets the test drive
 * the same code path a real drop would.
 */
const dnd = vi.hoisted(() => ({ onDragEnd: null }));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children, onDragEnd }) => {
    dnd.onDragEnd = onDragEnd;
    return <div data-testid="drag-drop-context">{children}</div>;
  },
  Droppable: ({ children, droppableId }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: { "data-droppable-id": droppableId },
        placeholder: null,
      },
      { isDraggingOver: false }
    ),
  Draggable: ({ children, draggableId }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: { "data-draggable-id": draggableId },
        dragHandleProps: {},
      },
      { isDragging: false }
    ),
}));

const DEALS = [
  { id: 1, title: "Alpha renewal", stage: "new", value: 5000, probability: 10 },
  { id: 2, title: "Beta expansion", stage: "qualified", value: 12000, probability: 40 },
];

function renderBoard(overrides = {}) {
  const props = {
    deals: DEALS,
    onStageChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const utils = render(<KanbanBoard {...props} />);
  return { ...props, ...utils };
}

function drop(draggableId, from, to) {
  act(() => {
    dnd.onDragEnd({
      draggableId: String(draggableId),
      source: { droppableId: from, index: 0 },
      destination: to ? { droppableId: to, index: 0 } : null,
    });
  });
}

describe("KanbanBoard", () => {
  it("renders one column per pipeline stage", () => {
    const { container } = renderBoard();

    const columns = container.querySelectorAll("[data-droppable-id]");
    expect(columns).toHaveLength(7);
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
  });

  it("renders a card for every deal", () => {
    renderBoard();

    expect(screen.getByText("Alpha renewal")).toBeInTheDocument();
    expect(screen.getByText("Beta expansion")).toBeInTheDocument();
  });

  it("calls onStageChange with the deal id and destination stage after a cross-column drop", () => {
    const { onStageChange } = renderBoard();

    drop(1, "new", "proposal");

    expect(onStageChange).toHaveBeenCalledTimes(1);
    expect(onStageChange).toHaveBeenCalledWith(1, "proposal");
  });

  it("does not persist a drop inside the same column", () => {
    const { onStageChange } = renderBoard();

    drop(2, "qualified", "qualified");

    expect(onStageChange).not.toHaveBeenCalled();
  });

  it("does not persist a drop outside any column", () => {
    const { onStageChange } = renderBoard();

    drop(1, "new", null);

    expect(onStageChange).not.toHaveBeenCalled();
  });
});
