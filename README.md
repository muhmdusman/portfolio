# Muhammad Usman | 3D Portfolio

An interactive portfolio built with **Next.js 16**, **React 19** and **Three.js**. The page is a normal, server-rendered website (fast, crawlable, accessible). Behind it, a hand-modelled 3D room floats above the clouds, and the camera flies through it as you scroll.

Content comes from [muhmdusman/React-js-Portfolio](https://github.com/muhmdusman/React-js-Portfolio). The 3D direction takes inspiration from [david-hckh.com](https://david-hckh.com/); no code or assets were copied from it.

## What's in it

- **A procedural 3D room.** The desk, a monitor, a mechanical keyboard, mouse, lamp, coffee mug, RGB PC tower, office chair, window, shelf with a rubber duck, a framed photo, a neon `</>` sign, a plant and low-poly clouds are all built from Three.js primitives. There are no model files to download.
- **A computer that mirrors the page.** The monitor runs "UsmanOS", a desktop drawn into a canvas texture. Each section opens a different app on it:
  - Home: a terminal that types the same phrases as the hero typewriter.
  - Skills: a code editor showing the selected category.
  - Projects: a browser showing the project you hover or scroll to.
  - Experience: a `git log` of the work history.
  - Contact: a mail app that shows the message as you type it.
- **A keyboard that types along.** Every character typed by the hero typewriter or in the contact form presses the matching key on the 3D keyboard. All 61 keycaps are one instanced mesh, so this is a single draw call.
- **Skills orbiting the room.** Every skill is a floating app icon. When you pick a category, its icons leave the orbit and line up in front of the camera. This is one instanced draw call with the motion done in the vertex shader.
- **A scroll-driven camera.** Each section has its own camera shot, with separate shots for landscape and portrait screens. The camera eases between them as you scroll and adds a little pointer parallax.
- **A macOS-style dock as the main menu.** Icons magnify under the cursor and bounce when clicked. A dot marks the section you're in, and social links sit after the divider.
- **Easter eggs.** Click the lamp, the PC tower (it cycles RGB modes), the rubber duck, the plant or the mug. Clicking the monitor jumps to Projects.

## Performance

- The hero is server-rendered HTML, so the LCP element is text. The Three.js world is a separate chunk that only downloads once the browser is idle (`requestIdleCallback`), and it fades in after its shaders are precompiled.
- No extra runtime dependencies: just `next`, `react` and `three`. Animation, damping and the dock use small in-house helpers, and icons are bundled as inline SVG (`lib/icons.ts`) instead of being fetched at runtime.
- The shadow map renders once, after the intro, because nothing large moves after that. Glows are additive sprites instead of a post-processing pass, and static props share materials.
- Resolution adapts to the device. The pixel ratio is capped (1.5 on phones, 2 on desktop) and drops automatically when frames run slow. Phones get fewer particles and fewer lights.
- The render loop pauses when the tab is hidden. The canvas is sized to the large viewport so mobile URL-bar animations don't reallocate it.
- The monitor texture is re-uploaded only when its content changes, at most 30 times per second.
- Images were converted to WebP: about 345 KB total for the nine project screenshots, down from about 2.9 MB, and 65 KB for the profile photo, down from 994 KB. Pages use `next/image`, and the screenshots for the 3D monitor are lazy-loaded at idle time.
- Scroll reveals use CSS scroll-driven animations, so no JavaScript runs for them, and content stays visible in browsers without support.
- `prefers-reduced-motion` is respected: no intro flight, idle animation or parallax.
- Without WebGL, the site shows a pre-rendered frame of the room (`public/images/room-fallback.webp`).

## SEO and accessibility

- Metadata, Open Graph and Twitter cards, a canonical URL, `sitemap.xml`, `robots.txt`, a web manifest and schema.org `Person` JSON-LD.
- `public/google0a415f599e366e4a.html` is carried over so Google Search Console verification keeps working.
- Semantic sections and headings, a skip link, keyboard-operable tabs (arrow keys, Home and End) and a native `<dialog>` for project details. The 3D canvas is `aria-hidden`; all content lives in the DOM.

## Project structure

```
app/                 layout (fonts, metadata, JSON-LD), page, sitemap, robots, manifest, icons
components/
  chrome/            top bar, local time (PKT), active-section tracker
  dock/              dock markup (server) + magnification/active/bounce behaviour (client)
  scene/             <Scene/>: lazy-loads the Three.js world into a fixed canvas
  sections/          Hero, Skills, Projects, Experience, Contact (+ small client islands)
  ui/                Icon, SectionHeading
content/portfolio.ts all copy and data (edit this to update the site)
lib/                 shared store (UI <-> 3D), icons, site config
three/
  World.ts           renderer, lights, loop, adaptive quality, hotspots, disposal
  CameraRig.ts       scroll-driven camera shots, parallax, intro flight
  objects/           Room, Computer (desk/monitor/keyboard/PC), ScreenUI, SkillsRing, Atmosphere
  core/              materials, procedural textures, math helpers
styles/              chrome.css (scene, top bar, dock), sections.css
```

The UI and the 3D world never import each other. They talk through `lib/store.ts`: React writes things like the active section, the selected skill category, the hovered project and the contact draft, and the world subscribes to them.

## Editing content

Update `content/portfolio.ts`. Screenshots live in `public/images/projects/` (WebP, 1024 px wide). Titles mark the highlighted word with `*asterisks*`.

## Environment variables

Copy `.env.example` to `.env.local` if you need to override either value:

| Variable                    | Default                    | Purpose                                         |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | `https://muhmdusman.space` | Canonical URL, Open Graph and sitemap            |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | key from the previous site | [Web3Forms](https://web3forms.com) contact form |

## Scripts

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint
```

## Credits

- Icons: [Simple Icons](https://simpleicons.org) (CC0), [Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache 2.0) and [SVG Logos](https://github.com/gilbarbara/logos) (CC0), bundled from the Iconify sets. Brand icons are trademarks of their owners.
- Fonts: Space Grotesk and JetBrains Mono through `next/font`.
- Design inspiration: [David Heckhoff's portfolio](https://david-hckh.com/).
