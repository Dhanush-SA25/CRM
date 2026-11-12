/**
 * Generic hook for async data fetching.
 * Returns { data, loading, error, refetch }.
 */
import { useState, useEffect, useCallback, useRef } from "react";

export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (isMounted.current) setData(result);
    } catch (err) {
      if (isMounted.current)
        setError(err?.response?.data?.error || err.message || "An error occurred");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => { isMounted.current = false; };
  }, [run]);

  return { data, loading, error, refetch: run };
}
