import type { MetadataRoute } from "next";
import { profile } from "@/content/portfolio";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} | Portfolio`,
    short_name: profile.firstName,
    description: profile.description,
    start_url: "/",
    display: "standalone",
    background_color: "#040c16",
    theme_color: "#040c16",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
