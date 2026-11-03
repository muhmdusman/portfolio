import { SectionTracker } from "@/components/chrome/SectionTracker";
import { TopBar } from "@/components/chrome/TopBar";
import { Dock } from "@/components/dock/Dock";
import { Scene } from "@/components/scene/Scene";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";

export default function Home() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Scene />
      <TopBar />
      <main id="main">
        <Hero />
        <Skills />
        <Projects />
        <Experience />
        <Contact />
      </main>
      <Dock />
      <SectionTracker />
    </>
  );
}
