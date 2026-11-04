import { projects, projectsSection } from "@/content/portfolio";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";
import { ProjectList } from "./ProjectList";

export function Projects() {
  return (
    <section id="projects" data-section="projects" className="section section--projects" aria-labelledby="projects-title">
      <div className="wrap">
        <div className="panel panel--wide" data-ui>
          <SectionHeading
            id="projects-title"
            eyebrow={projectsSection.eyebrow}
            title={projectsSection.title}
            lead="Hover or scroll through the list to load each site on the monitor. Open one for the full story."
          />
          <ProjectList
            projects={projects}
            icons={{
              open: <Icon name="mdi:arrow-top-right" />,
              close: <Icon name="mdi:close" />,
              external: <Icon name="mdi:arrow-top-right" />,
            }}
          />
        </div>
      </div>
    </section>
  );
}
