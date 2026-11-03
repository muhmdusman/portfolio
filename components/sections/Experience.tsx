import { experienceSection, roles } from "@/content/portfolio";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";

export function Experience() {
  return (
    <section id="experience" data-section="experience" className="section" aria-labelledby="experience-title">
      <div className="wrap">
        <div className="panel" data-ui>
          <SectionHeading
            id="experience-title"
            eyebrow={experienceSection.eyebrow}
            title={experienceSection.title}
            lead="The same history is on the monitor as a git log."
          />
          <ol className="timeline">
            {roles.map((role, i) => (
              <li key={role.company} className="timeline__item" data-reveal>
                <span className="timeline__marker" aria-hidden="true" data-current={i === 0 ? "true" : undefined} />
                <article className="role">
                  <header className="role__header">
                    <h3 className="role__title">{role.title}</h3>
                    <p className="role__company">
                      {role.company}
                      <span className="role__mode">{role.workMode}</span>
                    </p>
                  </header>
                  <p className="role__meta">
                    <Icon name="mdi:calendar-blank-outline" />
                    <span>{role.period}</span>
                    <span className="badge">{role.jobType}</span>
                  </p>
                  <p className="role__desc">{role.description}</p>
                  <ul className="chips chips--accent" aria-label="Highlights">
                    {role.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
