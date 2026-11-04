import { icons, type IconName } from "@/lib/icons";

interface IconProps {
  name: IconName;
  className?: string;
  /** Accessible label. Omit for decorative icons. */
  title?: string;
  color?: string;
}

/** Inline SVG icon from the bundled icon set (no runtime fetch). */
export function Icon({ name, className, title, color }: IconProps) {
  const icon = icons[name];
  return (
    <svg
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      className={className ? `icon ${className}` : "icon"}
      style={color ? { color } : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
