import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { PageFrame } from "../ui/PageFrame";

export function NotFound() {
  useDocumentTitle("Page not found");

  return (
    <main className="bg-bg text-text h-dvh">
      <PageFrame
        layout="scroll"
        align="center"
        contentClassName="items-center px-4 py-12 text-center"
      >
        <FileQuestion
          aria-hidden="true"
          className="text-subtle size-6"
          strokeWidth={1.5}
        />
        <h1 className="text-base font-medium">Page not found</h1>
        <p className="text-muted max-w-prose text-sm">
          The address may be out of date or the page may have moved.
        </p>
        <Link
          to="/map"
          className="h-touch border-border-strong bg-surface text-text hover:bg-surface-2 md:h-control-md mt-2 inline-flex items-center rounded-md border px-3 text-base font-medium"
        >
          Back to the map
        </Link>
      </PageFrame>
    </main>
  );
}
