import Image from "next/image";
import type { CSSProperties } from "react";
import { profile, socials, stats } from "@/content/portfolio";
import { Icon } from "../ui/Icon";
import { Typewriter } from "./Typewriter";

/** Stagger index for the entrance animation. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero() {
  return (
    <section id="home" data-section="home" className="section section--hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero" data-ui>
          <p className="hero__hello" style={order(0)}>
            <Image
              src={profile.image}
              alt=""
              width={40}
              height={40}
              className="hero__avatar"
              loading="eager"
              sizes="40px"
            />
            <span>{profile.greeting}</span>
            <span className="hero__wave" aria-hidden="true">
              👋
            </span>
          </p>
          <h1 id="hero-title" className="hero__title" style={order(1)}>
            Muhammad <span className="hero__title-last accent">Usman</span>
          </h1>
          <p className="hero__role" style={order(2)}>
            {profile.role}
          </p>
          <p className="hero__typing" style={order(3)}>
            <span className="hero__prompt" aria-hidden="true">
              &gt;
            </span>
            <Typewriter phrases={profile.typing} pauseMs={profile.typingPauseMs} />
            <span className="sr-only">{profile.typing.join(". ")}</span>
          </p>
          <p className="hero__desc" style={order(4)}>
            {profile.description}
          </p>
          <div className="hero__actions" style={order(5)}>
            <a href="#contact" className="btn btn--primary">
              Let’s Connect
              <Icon name="mdi:arrow-right" />
            </a>
            <a href="#projects" className="btn btn--ghost">
              View my work
            </a>
          </div>
          <ul className="socials" style={order(6)} aria-label="Social profiles">
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="socials__link" aria-label={`${s.label} (opens in a new tab)`}>
                  <Icon name={s.icon} />
                </a>
              </li>
            ))}
          </ul>
          <dl className="stats" style={order(7)}>
            {stats.map((s) => (
              <div key={s.label} className="stats__item">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <a href="#skills" className="scroll-hint">
        <span className="scroll-hint__mouse" aria-hidden="true" />
        Scroll to explore the workspace
      </a>
    </section>
  );
}
