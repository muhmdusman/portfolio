import { contactSection, profile, socials } from "@/content/portfolio";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";
import { ContactForm } from "./ContactForm";

export function Contact() {
  return (
    <section id="contact" data-section="contact" className="section section--contact" aria-labelledby="contact-title">
      <div className="wrap">
        <div className="panel" data-ui>
          <SectionHeading id="contact-title" eyebrow={contactSection.eyebrow} title={contactSection.title} lead={contactSection.subtitle} />
          <ul className="contact-links" data-reveal>
            <li>
              <a href={`mailto:${profile.email}`} className="contact-link">
                <Icon name="mdi:email-outline" />
                <span>
                  <span className="contact-link__label">Write an e-mail</span>
                  <span className="contact-link__value">
                    {profile.email.split("@")[0]}@<wbr />
                    {profile.email.split("@")[1]}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a href={`tel:${profile.phone.replace(/\s/g, "")}`} className="contact-link">
                <Icon name="mdi:phone-outline" />
                <span>
                  <span className="contact-link__label">Call or WhatsApp</span>
                  <span className="contact-link__value">{profile.phone}</span>
                </span>
              </a>
            </li>
          </ul>
          <div data-reveal>
            <ContactForm
              icons={{
                send: <Icon name="mdi:send" />,
                success: <Icon name="mdi:check-circle-outline" />,
                error: <Icon name="mdi:alert-circle-outline" />,
              }}
            />
          </div>
          <ul className="socials socials--row" aria-label="Social profiles">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="socials__link" aria-label={`${s.label} (opens in a new tab)`}>
                  <Icon name={s.icon} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <footer className="footer">
        <p>© Muhammad Usman. Designed and built with Next.js and Three.js.</p>
        <a href="#home" className="footer__top">
          Back to top
          <Icon name="mdi:arrow-up" />
        </a>
      </footer>
    </section>
  );
}
