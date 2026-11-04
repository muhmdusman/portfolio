import type { IconName } from "@/lib/icons";

/**
 * All portfolio copy lives here. It was carried over from
 * github.com/muhmdusman/React-js-Portfolio (src/data/*.json), with small
 * typo fixes. Titles use `*word*` to mark the highlighted word.
 */

export type SectionId = "home" | "skills" | "projects" | "experience" | "contact";

export const sections: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
];

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
  handle: string;
}

export interface Skill {
  name: string;
  icon: IconName;
  /** Brand color for the glyph. Omit for multi-color logos. */
  color?: string;
  note?: string;
}

export interface SkillCategory {
  key: string;
  label: string;
  accent: string;
  /** File name shown in the 3D code editor. */
  file: string;
  skills: Skill[];
}

export type ProjectStatus = "live" | "in-progress" | "archived";

export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  detailsTitle: string;
  description: string;
  type: string;
  stack: string[];
  platform: string;
  country: string;
  url?: string;
  status: ProjectStatus;
}

export interface Role {
  title: string;
  company: string;
  workMode: string;
  period: string;
  jobType: string;
  description: string;
  highlights: string[];
  /** Short tag used in the 3D `git log` view. */
  tag: string;
}

export const profile = {
  name: "Muhammad Usman",
  firstName: "Usman",
  greeting: "Hey! I’m Usman",
  role: "Web Engineer · SEO · Cloud",
  image: "/images/profile.webp",
  typing: ["I'm a Dev", "YOU'RE IN CLOUD!", "I TYPE, BUGS TAKE FLIGHT!"],
  typingPauseMs: 1500,
  description:
    "I build fast, well-optimized websites and help them get found through SEO, content and cloud-backed systems. I enjoy working on both the tech and the growth side of a product.",
  location: "Pakistan",
  timeZone: "Asia/Karachi",
  email: "musman.be25igis@student.nust.edu.pk",
  phone: "+92 330 1358202",
};

export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/muhmdusman", icon: "simple-icons:github", handle: "@muhmdusman" },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/muhammad-usman-0ba87a289/",
    icon: "simple-icons:linkedin",
    handle: "Muhammad Usman",
  },
  { label: "Instagram", href: "https://instagram.com/_muhmdusman_", icon: "simple-icons:instagram", handle: "@_muhmdusman_" },
  { label: "Credly", href: "https://credly.com/users/usman2789", icon: "mdi:certificate", handle: "Certifications" },
];

export const skillsSection = {
  eyebrow: "Technical Skills",
  title: "My *Technical* Expertise",
};

export const skillCategories: SkillCategory[] = [
  {
    key: "frontend",
    label: "Frontend Development",
    accent: "#ff6b6b",
    file: "frontend.ts",
    skills: [
      { name: "HTML5", icon: "simple-icons:html5", color: "#e34f26" },
      { name: "CSS3", icon: "simple-icons:css3", color: "#1572b6" },
      { name: "JavaScript (ES6+)", icon: "simple-icons:javascript", color: "#f7df1e" },
      { name: "React.js", icon: "simple-icons:react", color: "#61dafb" },
      { name: "Next.js", icon: "simple-icons:nextdotjs", color: "#ffffff" },
      { name: "Tailwind CSS", icon: "simple-icons:tailwindcss", color: "#06b6d4" },
      { name: "Leaflet", icon: "simple-icons:leaflet", color: "#199900", note: "Lightweight interactive web maps" },
      { name: "Mapbox GL JS", icon: "simple-icons:mapbox", color: "#ffffff", note: "Vector tiles and dynamic map rendering" },
    ],
  },
  {
    key: "seo",
    label: "SEO & Digital Marketing",
    accent: "#14b8a6",
    file: "seo.ts",
    skills: [
      { name: "Technical SEO", icon: "mdi:magnify-scan", color: "#38bdf8" },
      { name: "Core Web Vitals", icon: "mdi:heart-pulse", color: "#ef4444", note: "LCP, CLS, and INP improvements" },
      { name: "Google Search Console", icon: "simple-icons:googlesearchconsole", color: "#458cf5" },
      { name: "Meta Ads", icon: "simple-icons:meta", color: "#0467df" },
      { name: "Content Writing", icon: "mdi:pencil-outline", color: "#f59e0b" },
      { name: "Social Media Management", icon: "mdi:account-group-outline", color: "#ec4899" },
      {
        name: "Social Media Analytics",
        icon: "mdi:chart-line",
        color: "#22c55e",
        note: "Meta Business Suite, LinkedIn Analytics",
      },
    ],
  },
  {
    key: "cms",
    label: "CMS & Platforms",
    accent: "#ec4899",
    file: "cms.ts",
    skills: [
      { name: "Shopify", icon: "simple-icons:shopify", color: "#7ab55c" },
      { name: "WordPress", icon: "simple-icons:wordpress", color: "#21759b" },
      { name: "Webflow", icon: "simple-icons:webflow", color: "#146ef5" },
      { name: "Framer", icon: "simple-icons:framer", color: "#ffffff" },
    ],
  },
  {
    key: "backend",
    label: "Backend & APIs",
    accent: "#3b82f6",
    file: "backend.ts",
    skills: [
      { name: "Node.js", icon: "simple-icons:nodedotjs", color: "#5fa04e" },
      { name: "API Design & Architecture", icon: "mdi:api", color: "#38bdf8" },
      {
        name: "Clerk Authentication",
        icon: "simple-icons:clerk",
        color: "#6c47ff",
        note: "Authentication and user management",
      },
    ],
  },
  {
    key: "cloud",
    label: "Cloud & Databases",
    accent: "#8b5cf6",
    file: "cloud.ts",
    skills: [
      { name: "AWS", icon: "simple-icons:amazonaws", color: "#ff9900", note: "Lambda, Bedrock, Amplify" },
      { name: "Google Cloud Platform (GCP)", icon: "logos:google-cloud", note: "GCP services and deployments" },
      {
        name: "Cloudflare",
        icon: "simple-icons:cloudflare",
        color: "#f38020",
        note: "Workers, R2 storage, Cloudflare Images, and WAF",
      },
      { name: "Vercel", icon: "simple-icons:vercel", color: "#ffffff" },
      { name: "PostgreSQL", icon: "simple-icons:postgresql", color: "#336791" },
    ],
  },
  {
    key: "devops",
    label: "DevOps & Tools",
    accent: "#f59e0b",
    file: "devops.ts",
    skills: [
      { name: "Git", icon: "logos:git-icon" },
      { name: "GitHub", icon: "simple-icons:github", color: "#ffffff" },
      { name: "CI/CD", icon: "mdi:source-branch", color: "#22c55e", note: "Automated build and release workflows" },
      { name: "Figma", icon: "simple-icons:figma", color: "#f24e1e" },
    ],
  },
];

export const projectsSection = {
  eyebrow: "My Work",
  title: "Recent *Projects*",
};

export const projects: Project[] = [
  {
    slug: "markaz-web",
    title: "Markaz Web",
    subtitle: "Web Application Development",
    image: "/images/projects/markaz.webp",
    detailsTitle: "Markaz Web Platform",
    description:
      "Built and scaled modern web application features for Markaz with a strong focus on performance, reliability, and cloud-backed architecture. Worked across Next.js, MongoDB, Firebase, AWS Lambda APIs, GCP Cloud Run, Cloud Functions, and Cloudflare services to support secure and scalable product delivery.",
    type: "Website",
    stack: ["Next.js", "MongoDB", "Firebase", "AWS Lambda", "GCP Cloud Run", "Cloud Functions"],
    platform: "Custom (Built with Code)",
    country: "Pakistan",
    status: "live",
  },
  {
    slug: "zocial-plug",
    title: "Zocial Plug",
    subtitle: "Development",
    image: "/images/projects/zocial-plug.webp",
    detailsTitle: "Website for a Marketing Agency",
    description:
      "Developed Zocial Plug, a marketing agency website offering branding, social media management, and digital growth strategies. Designed for performance and user engagement to help businesses maximize their online presence.",
    type: "Website",
    stack: ["HTML", "CSS", "JavaScript"],
    platform: "Custom (Built with Code)",
    country: "USA",
    url: "https://zocialplug.vercel.app",
    status: "live",
  },
  {
    slug: "al-taj-ristorante",
    title: "Al Taj Ristorante",
    subtitle: "Restaurant Website",
    image: "/images/projects/al-taj-ristorante.webp",
    detailsTitle: "Website for an Italian Ristorante",
    description:
      "Designed and developed the website for Al Taj Ristorante, a restaurant in Italy serving Pakistani, Indian and Italian dishes. It includes the full menu, online ordering and table reservations.",
    type: "Website",
    stack: ["Next.js"],
    platform: "Custom (Built with Code)",
    country: "Italy",
    url: "https://www.altaj-ristorante.it",
    status: "live",
  },
  {
    slug: "taleem-ka-safar",
    title: "Taleem ka Safar",
    subtitle: "Development",
    image: "/images/projects/taleem-ka-safar.webp",
    detailsTitle: "Education Website",
    description: "Designed and developed an educational site for university entrance exam test practice.",
    type: "Website",
    stack: ["Next.js", "Clerk"],
    platform: "Custom (Built with Code)",
    country: "Pakistan",
    url: "https://www.taleemkasafar.com",
    status: "live",
  },
  {
    slug: "yousaf-n-company",
    title: "Yousaf n Company",
    subtitle: "News Magazine Website Development",
    image: "/images/projects/yousaf-n-company.webp",
    detailsTitle: "News Magazine Website Development",
    description:
      "Developed a news magazine website designed for seamless content delivery and user engagement. Built with WordPress, and optimized for fast performance to maximize customer engagement.",
    type: "Website",
    stack: ["HTML", "CSS", "JavaScript", "jQuery"],
    platform: "WordPress",
    country: "UAE",
    status: "live",
  },
  {
    slug: "aq-solar-solutions",
    title: "AQ Solar Solutions",
    subtitle: "Website Development",
    image: "/images/projects/aq-solar-solutions.webp",
    detailsTitle: "Website Development for a Solar Company",
    description:
      "Developed AQ Solar Solution, a solar energy website designed for lead generation and customer engagement. Optimized for SEO, performance, and user-friendly navigation to enhance online visibility and conversions.",
    type: "Website",
    stack: ["PHP", "HTML", "CSS", "JavaScript"],
    platform: "WordPress",
    country: "Pakistan",
    url: "https://www.aqsolarsolution.com",
    status: "live",
  },
  {
    slug: "digitaluq",
    title: "Digitaluq",
    subtitle: "Website Development",
    image: "/images/projects/digitaluq.webp",
    detailsTitle: "Website Design & Development for an International Marketing Agency",
    description:
      "Built DigitalUQ, a marketing agency website designed for brand visibility, client acquisition, and SEO optimization. Features a sleek UI, fast performance, and strategic content placement to enhance digital growth and engagement.",
    type: "Website",
    stack: ["HTML", "CSS", "JavaScript"],
    platform: "Custom (Built with Code)",
    country: "USA",
    url: "https://digitaluq.vercel.app",
    status: "live",
  },
  {
    slug: "money-makers-media",
    title: "Money Makers Media",
    subtitle: "News Magazine Website Development",
    image: "/images/projects/money-makers-media.webp",
    detailsTitle: "News Magazine Website Development",
    description:
      "Developed a news magazine website designed for seamless content delivery and user engagement. Built with WordPress, and optimized for fast performance to maximize customer engagement. Inactive, closed by client.",
    type: "Website",
    stack: ["HTML", "CSS", "JavaScript", "jQuery"],
    platform: "WordPress",
    country: "UAE",
    status: "archived",
  },
  {
    slug: "theignite",
    title: "Theignite.pk",
    subtitle: "Ecommerce Store Development",
    image: "/images/projects/theignite.webp",
    detailsTitle: "Store Design and Development for a Startup",
    description:
      "Developed TheIgnite.pk, a feature-rich eCommerce store designed for seamless shopping experiences. Built with Shopify, secure payment gateways, and optimized for SEO and fast performance to maximize sales and customer engagement. Inactive, closed by client.",
    type: "Website",
    stack: ["Liquid", "CSS", "JavaScript"],
    platform: "Shopify",
    country: "Pakistan",
    status: "archived",
  },
];

export const experienceSection = {
  eyebrow: "Experience",
  title: "My Work *Experience*",
};

export const roles: Role[] = [
  {
    title: "Web Engineer",
    company: "MARKAZ",
    workMode: "On-site",
    period: "Sep 2025 – May 2026",
    jobType: "Full Time",
    description:
      "At Markaz, a Y Combinator-backed company, I build and scale web applications with Next.js, MongoDB and Firebase, and work with AWS Lambda, GCP Cloud Run and Cloudflare (Workers, R2, Images, WAF, CDN) for fast and secure delivery. I also lead SEO and performance work: Core Web Vitals, structured data and sitemap automation. This helped move key pages from the 4th page of Google to the first page and top positions, with organic clicks up 58% and impressions up 61% in 3 months.",
    highlights: ["Page 4 → Page 1 on Google", "+58% organic clicks", "+61% impressions in 3 months"],
    tag: "markaz",
  },
  {
    title: "Full Stack Developer",
    company: "DigiTaluq",
    workMode: "Remote",
    period: "Nov 2024 – Jul 2025",
    jobType: "Part Time",
    description:
      "At DigiTaluq, a digital agency, I built websites and e-commerce stores with Shopify, WordPress, React.js and Next.js. Beyond development, I designed graphics, did SEO and ran paid Meta Ads campaigns to help small businesses build their online presence.",
    highlights: ["Shopify & WordPress stores", "SEO + Meta Ads campaigns"],
    tag: "digitaluq",
  },
  {
    title: "Front-end Developer",
    company: "Daira Eng.",
    workMode: "On-site",
    period: "Jul 2024 – Oct 2024",
    jobType: "Full Time",
    description:
      "I started my career at Daira Engineering, building responsive interfaces with React and Tailwind CSS. This is where I first worked with Next.js and Node.js and learned how to deliver as part of a team.",
    highlights: ["React + Tailwind CSS", "First Next.js & Node.js work"],
    tag: "daira",
  },
];

export const contactSection = {
  eyebrow: "Contact",
  title: "Let’s *Discuss* Your Project",
  subtitle:
    "Always available for freelancing if the right project comes along. Feel free to contact me.",
};

/** Hero numbers. "Countries served" is derived from the project list so it stays correct. */
export const stats = [
  { value: "25+", label: "Projects delivered" },
  { value: String(new Set(projects.map((p) => p.country)).size), label: "Countries served" },
  { value: "+58%", label: "Organic clicks at Markaz" },
];
