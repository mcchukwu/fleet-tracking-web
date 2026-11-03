import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  useDocumentTitle(title);

  return (
    <div className="min-h-screen bg-bg text-text">
      <main className="mx-auto flex min-h-screen max-w-screen-md flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:px-6">
        <Construction aria-hidden="true" className="size-6 text-subtle" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <p className="max-w-prose text-sm text-muted">{description}</p>
        <Link
          to="/styleguide"
          className="mt-2 inline-flex h-control-md items-center rounded-md border border-border-strong bg-surface px-3 text-base font-medium text-text hover:bg-surface-2"
        >
          Open the styleguide
        </Link>
      </main>
    </div>
  );
}
