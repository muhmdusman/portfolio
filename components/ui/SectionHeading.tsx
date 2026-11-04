import { Fragment } from "react";

/** Renders `*word*` in a title as the accent-colored highlight. */
export function Highlight({ text }: { text: string }) {
  return text.split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <span key={i} className="accent">
        {part.slice(1, -1)}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}

export function SectionHeading({ id, eyebrow, title, lead }: SectionHeadingProps) {
  return (
    <header className="section-heading" data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="section-title">
        <Highlight text={title} />
      </h2>
      {lead ? <p className="section-lead">{lead}</p> : null}
    </header>
  );
}
