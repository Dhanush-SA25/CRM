import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadExport } from "../../utils/download";

export default function ExportButton({
  resource,
  params = {},
  label = "Export CSV",
  className = "btn-secondary",
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      await downloadExport(resource, params);
    } catch (err) {
      setError(err?.response?.data?.error || "Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className={className}
        title={error || "Download the current records as CSV"}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {busy ? "Exporting…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
