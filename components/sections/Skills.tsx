import type { CSSProperties } from "react";
import { skillCategories, skillsSection } from "@/content/portfolio";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";
import { SkillTabs } from "./SkillTabs";

export function Skills() {
  const tabs = skillCategories.map((c) => ({ key: c.key, label: c.label, accent: c.accent, count: c.skills.length }));
  const panels = skillCategories.map((category) => (
    <ul key={category.key} className="skill-grid">
      {category.skills.map((skill, i) => (
        <li key={skill.name} className="skill-card" style={{ "--i": i, "--accent": category.accent } as CSSProperties}>
          <span className="skill-card__icon">
            <Icon name={skill.icon} color={skill.color} />
          </span>
          <span className="skill-card__text">
            <span className="skill-card__name">{skill.name}</span>
            {skill.note ? <span className="skill-card__note">{skill.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  ));

  return (
    <section id="skills" data-section="skills" className="section" aria-labelledby="skills-title">
      <div className="wrap">
        <div className="panel" data-ui>
          <SectionHeading
            id="skills-title"
            eyebrow={skillsSection.eyebrow}
            title={skillsSection.title}
            lead="Pick a category and watch those tools line up in the 3D scene."
          />
          <div data-reveal>
            <SkillTabs tabs={tabs} panels={panels} />
          </div>
        </div>
      </div>
    </section>
  );
}
