import { Fragment, type ReactNode } from "react";

const TOKEN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\s][^_\n]*_|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

/** Renders inline Markdown (bold, italics, code, links) as React nodes. Pair with `whitespace-pre-wrap`. */
export function renderInline(text: string): ReactNode[] {
  return text
    .split(TOKEN)
    .filter((part) => part !== "")
    .map((part, index) => {
      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return (
          <strong key={index} className="font-semibold text-parchment">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.length > 2 && ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="rounded bg-surface-high px-1.5 py-0.5 font-mono text-[0.85em] text-gold-soft">
            {part.slice(1, -1)}
          </code>
        );
      }
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link && /^https?:\/\//.test(link[2])) {
        return (
          <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-4">
            {link[1]}
          </a>
        );
      }
      return <Fragment key={index}>{part}</Fragment>;
    });
}
