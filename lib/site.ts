import { profile, skillCategories, socials } from "@/content/portfolio";

/** Public URL used for canonical links, Open Graph and the sitemap. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://muhmdusman.space").replace(/\/$/, "");

export const siteTitle = `${profile.name} | Web Engineer, SEO & Cloud`;
export const siteDescription = profile.description;

/** schema.org Person data for rich results. */
export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  url: siteUrl,
  image: `${siteUrl}${profile.image}`,
  jobTitle: "Web Engineer",
  description: profile.description,
  email: `mailto:${profile.email}`,
  telephone: profile.phone.replace(/\s/g, ""),
  address: { "@type": "PostalAddress", addressCountry: "PK" },
  sameAs: socials.map((s) => s.href),
  knowsAbout: skillCategories.flatMap((c) => c.skills.map((s) => s.name)),
};
