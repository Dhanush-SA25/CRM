export default function TableSkeleton({ rows = 6, columns = 5, className = "" }) {
  return (
    <div className={`divide-y divide-slate-100 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className={`h-3.5 skeleton ${columnIndex === 0 ? "w-3/4" : "w-1/2"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
