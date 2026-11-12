import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Opens a module's create modal when the URL carries ?new=1, then removes the
 * flag so a refresh doesn't reopen it. Used by the topbar quick-create menu
 * and the command palette.
 */
export function useAutoOpenCreate(openCreate) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openCreate]);
}
