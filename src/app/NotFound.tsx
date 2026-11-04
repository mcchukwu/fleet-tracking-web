import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Page not found");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg px-4 py-12 text-center text-text">
      <FileQuestion aria-hidden="true" className="size-6 text-subtle" strokeWidth={1.5} />
      <h1 className="text-base font-medium">Page not found</h1>
      <p className="max-w-prose text-sm text-muted">
        The address may be out of date or the page may have moved.
      </p>
      <Link
        to="/map"
        className="mt-2 inline-flex h-control-md items-center rounded-md border border-border-strong bg-surface px-3 text-base font-medium text-text hover:bg-surface-2"
      >
        Back to the map
      </Link>
    </main>
  );
}
