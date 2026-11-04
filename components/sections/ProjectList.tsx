"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Project } from "@/content/portfolio";
import { store } from "@/lib/store";
import { usePortfolio } from "@/lib/usePortfolio";

interface ProjectListProps {
  projects: Project[];
  icons: { open: ReactNode; close: ReactNode; external: ReactNode };
}

const STATUS_LABEL: Record<Project["status"], string> = {
  live: "Delivered",
  "in-progress": "In development",
  archived: "Archived · closed by client",
};

const shortPlatform = (p: string) => (p.startsWith("Custom") ? "Custom code" : p);

export function ProjectList({ projects, icons }: ProjectListProps) {
  const active = usePortfolio((s) => s.projectIndex);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const hoveringRef = useRef(false);

  // While scrolling, the row crossing the middle of the viewport drives the 3D monitor.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (hoveringRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            store.setState({ projectIndex: Number((entry.target as HTMLElement).dataset.index) });
          }
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    list.querySelectorAll("[data-index]").forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) dialog.showModal();
    if (openIndex === null && dialog.open) dialog.close();
  }, [openIndex]);

  const project = openIndex !== null ? projects[openIndex] : null;

  return (
    <>
      <ol
        ref={listRef}
        className="project-list"
        onPointerLeave={() => {
          hoveringRef.current = false;
        }}
      >
        {projects.map((p, i) => (
          <li key={p.slug} data-index={i} data-reveal>
            <button
              type="button"
              className="project-row"
              data-active={i === active ? "true" : undefined}
              aria-haspopup="dialog"
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                hoveringRef.current = true;
                store.setState({ projectIndex: i });
              }}
              onFocus={() => store.setState({ projectIndex: i })}
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                store.setState({ projectIndex: i });
                setOpenIndex(i);
              }}
            >
              <span className="project-row__index">{String(i + 1).padStart(2, "0")}</span>
              <span className="project-row__thumb">
                <Image src={p.image} alt="" fill sizes="(max-width: 640px) 72px, 96px" />
              </span>
              <span className="project-row__body">
                <span className="project-row__title">
                  {p.title}
                  {p.status !== "live" ? (
                    <span className={`badge badge--${p.status}`}>{p.status === "archived" ? "Archived" : "In progress"}</span>
                  ) : null}
                </span>
                <span className="project-row__meta">
                  {p.subtitle} · {shortPlatform(p.platform)} · {p.country}
                </span>
              </span>
              <span className="project-row__open" aria-hidden="true">
                {icons.open}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <dialog
        ref={dialogRef}
        className="project-dialog"
        aria-labelledby="project-dialog-title"
        onClose={() => {
          setOpenIndex(null);
          triggerRef.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        {project ? (
          <div className="project-dialog__inner">
            <button type="button" className="project-dialog__close" aria-label="Close project details" onClick={() => dialogRef.current?.close()}>
              {icons.close}
            </button>
            <div className="project-dialog__media">
              <Image
                src={project.image}
                alt={`${project.title} website screenshot`}
                width={1024}
                height={768}
                sizes="(max-width: 860px) 100vw, 520px"
              />
            </div>
            <div className="project-dialog__body">
              <p className="eyebrow">{project.subtitle}</p>
              <h3 id="project-dialog-title" className="project-dialog__title">
                {project.detailsTitle}
              </h3>
              <p className="project-dialog__desc">{project.description}</p>
              <dl className="facts">
                <div>
                  <dt>Type</dt>
                  <dd>{project.type}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{project.platform}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{project.country}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{STATUS_LABEL[project.status]}</dd>
                </div>
              </dl>
              <ul className="chips" aria-label="Tech stack">
                {project.stack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
              {project.url ? (
                <a className="btn btn--primary" href={project.url} target="_blank" rel="noopener noreferrer">
                  Visit live site
                  {icons.external}
                </a>
              ) : (
                <p className="project-dialog__note">This project has no public link.</p>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
