import { sections, socials, type SectionId } from "@/content/portfolio";
import type { IconName } from "@/lib/icons";
import { Icon } from "../ui/Icon";
import { DockShell } from "./DockShell";

const NAV_ICONS: Record<SectionId, IconName> = {
  home: "mdi:home-variant",
  skills: "mdi:layers-triple",
  projects: "mdi:folder-open",
  experience: "mdi:briefcase-variant",
  contact: "mdi:email-fast",
};

/**
 * macOS-style dock used as the main menu. The markup is server rendered;
 * `DockShell` adds magnification, the active-section dot and the bounce.
 */
export function Dock() {
  return (
    <nav className="dock" aria-label="Primary">
      <DockShell>
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`dock__item dock__item--${section.id}`}
            data-dock-item
            data-section-link={section.id}
          >
            <span className="dock__icon">
              <Icon name={NAV_ICONS[section.id]} />
            </span>
            <span className="dock__label">{section.label}</span>
            <span className="dock__dot" aria-hidden="true" />
          </a>
        ))}
        <span className="dock__sep" aria-hidden="true" />
        {socials.map((social, i) => (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`dock__item dock__item--${social.label.toLowerCase()}${i > 1 ? " dock__item--extra" : ""}`}
            data-dock-item
          >
            <span className="dock__icon">
              <Icon name={social.icon} />
            </span>
            <span className="dock__label">
              {social.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>
        ))}
      </DockShell>
    </nav>
  );
}
