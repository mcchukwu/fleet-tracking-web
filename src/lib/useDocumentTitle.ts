import { useEffect } from "react";
import { formatDocumentTitle } from "./documentTitle";

export function useDocumentTitle(title?: string, openAlerts?: number | string): void {
  useEffect(() => {
    document.title = formatDocumentTitle(title, openAlerts);
  }, [title, openAlerts]);
}
