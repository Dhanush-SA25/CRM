import { useEffect, useState } from "react";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import { leadService } from "../../services/leadService";

function scoreTone(score) {
  if (score >= 70) return "text-emerald-600 bg-emerald-50 ring-emerald-100";
  if (score >= 40) return "text-amber-600 bg-amber-50 ring-amber-100";
  return "text-red-600 bg-red-50 ring-red-100";
}

export default function LeadScoreModal({ isOpen, onClose, lead, onScored }) {
  const [scoring, setScoring] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (!lead) return;
    setLoading(true);
    setError("");
    try {
      const result = await leadService.rescore(lead.id);
      setScoring(result.scoring);
      onScored?.(result.lead);
    } catch (err) {
      setError(err?.response?.data?.error || "Could not recompute the score.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !lead) return;
    setScoring(null);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead?.id]);

  const score = scoring?.score ?? lead?.score ?? 0;
  const breakdown = scoring?.breakdown ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rule-based lead score">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ${scoreTone(
            score
          )}`}
        >
          <span className="text-2xl font-bold leading-none">{score}</span>
          <span className="text-[10px] font-medium">/ 100</span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{lead?.name}</p>
          <p className="text-sm text-slate-500">
            Deterministic score computed from stored lead fields — the same data always
            yields the same score.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Sparkles size={13} />
          Scoring breakdown
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" />
            Recomputing…
          </div>
        ) : breakdown.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No scoring rules contributed points to this lead.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {breakdown.map((item) => (
              <li
                key={item.rule}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{item.rule}</p>
                  <p className="truncate text-xs text-slate-400">{item.detail}</p>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-emerald-600">
                  +{item.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-secondary" onClick={run} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Recompute
        </button>
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
