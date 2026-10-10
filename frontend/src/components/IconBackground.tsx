import { useEffect, useState } from "react";
import { scienceIcons } from "../../icons";
import "./IconBackground.css";

const icons = Object.values(scienceIcons);
const spacing = 112;
const iconSize = 32;

type BackgroundIcon = {
  key: string;
  src: string;
  left: number;
  top: number;
  rotation: number;
};

function fillViewport(previous: BackgroundIcon[] = []): BackgroundIcon[] {
  const existing = new Map(previous.map((icon) => [icon.key, icon]));
  const columns = Math.ceil(window.innerWidth / spacing);
  const rows = Math.ceil(window.innerHeight / spacing);

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const key = `${column}-${row}`;

    return existing.get(key) ?? {
      key,
      src: icons[Math.floor(Math.random() * icons.length)].src,
      left: column * spacing + (spacing - iconSize) / 2,
      top: row * spacing + (spacing - iconSize) / 2,
      // Keep every icon upright, with a random tilt in either direction.
      rotation: Math.random() * 90 - 45,
    };
  });
}

export default function IconBackground() {
  const [pattern, setPattern] = useState(() => fillViewport());

  useEffect(() => {
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPattern(fillViewport));
    };

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="icon-background" aria-hidden="true">
      {pattern.map((icon) => (
        <img
          key={icon.key}
          src={icon.src}
          alt=""
          width={iconSize}
          height={iconSize}
          draggable={false}
          style={{
            left: icon.left,
            top: icon.top,
            transform: `rotate(${icon.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
