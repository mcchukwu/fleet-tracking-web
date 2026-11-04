import { Construction } from "lucide-react";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  useDocumentTitle(title);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-3 px-4 py-8 text-text sm:px-6">
      <h1 className="text-lg font-semibold text-text">{title}</h1>
      <p className="max-w-prose text-sm text-muted">{description}</p>
      <div className="mt-2 flex items-center gap-2 text-sm text-subtle">
        <Construction aria-hidden="true" className="size-4" strokeWidth={1.5} />
        This screen ships in a later slice.
      </div>
    </div>
  );
}
