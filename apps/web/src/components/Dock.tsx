"use client";

import { useEffect, useRef, useState } from "react";

type DockSide = "left" | "right" | "top" | "bottom";

type DockIconProps = { className?: string };

const IconCap = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Z" />
    <path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
  </svg>
);

const IconBook = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4.5 5.5h11a3 3 0 0 1 3 3v11h-11a3 3 0 0 0-3 3v-17Z" />
    <path d="M4.5 19.5h11" />
  </svg>
);

const IconCard = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3.5 7.5h17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
    <path d="M1.5 10h21" />
    <path d="M6 15.5h3" />
  </svg>
);

const IconClipboard = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 4.5h6" />
    <path d="M9 3h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

const IconUsers = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" />
    <path d="M8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" />
    <path d="M19 20a5 5 0 0 0-6-4" />
    <path d="M12 20a6 6 0 0 0-10 0" />
  </svg>
);

const IconPin = ({ className }: DockIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11Z" />
    <path d="M12 10.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />
  </svg>
);

const dockItems = [
  { key: "becas", label: "Becas", Icon: IconCap },
  { key: "oferta", label: "Oferta por planteles", Icon: IconBook },
  { key: "costos", label: "Costos académicos", Icon: IconCard },
  { key: "planes", label: "Planes de estudio", Icon: IconClipboard },
  { key: "directorio", label: "Directorio", Icon: IconUsers },
  { key: "planteles", label: "Planteles", Icon: IconPin },
];

const dockSize = {
  collapsed: 56,
  expanded: 220,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getNearestSide = (
  x: number,
  y: number,
  bounds: { width: number; height: number }
): DockSide => {
  const left = x;
  const right = bounds.width - x;
  const top = y;
  const bottom = bounds.height - y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return "left";
  if (min === right) return "right";
  if (min === top) return "top";
  return "bottom";
};

const Dock = () => {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [side, setSide] = useState<DockSide>("left");
  const [pos, setPos] = useState({ x: 24, y: 220 });
  const [limits, setLimits] = useState({ top: 120, bottom: 800 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updateLimits = () => {
      const height = window.innerHeight || 800;
      setLimits({ top: 120, bottom: Math.max(240, height - 120) });
    };
    updateLimits();
    window.addEventListener("resize", updateLimits);
    return () => window.removeEventListener("resize", updateLimits);
  }, []);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const bounds = document.body.getBoundingClientRect();
      const nextX = event.clientX - offsetRef.current.x;
      const nextY = event.clientY - offsetRef.current.y;
      setPos({
        x: clamp(nextX, 12, bounds.width - 12),
        y: clamp(nextY, limits.top, limits.bottom),
      });
    };

    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const bounds = document.body.getBoundingClientRect();
      const nextSide = getNearestSide(pos.x, pos.y, {
        width: bounds.width,
        height: bounds.height,
      });
      setSide(nextSide);
      setPos((current) => {
        const padding = 16;
        if (nextSide === "left") {
          return { x: padding, y: current.y };
        }
        if (nextSide === "right") {
          return { x: bounds.width - padding, y: current.y };
        }
        if (nextSide === "top") {
          return { x: current.x, y: limits.top + padding };
        }
        return { x: current.x, y: limits.bottom - padding };
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [limits.bottom, limits.top, pos.x, pos.y]);

  useEffect(() => {
    const handleResize = () => {
      const bounds = document.body.getBoundingClientRect();
      setPos((current) => ({
        x: clamp(current.x, 12, bounds.width - 12),
        y: clamp(current.y, limits.top, limits.bottom),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [limits.bottom, limits.top]);

  const orientation = side === "left" || side === "right" ? "vertical" : "horizontal";

  const handleMouseDown = (event: React.MouseEvent) => {
    if (isOpen) return;
    draggingRef.current = true;
    const rect = dockRef.current?.getBoundingClientRect();
    if (rect) {
      offsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }
  };

  const sizeStyle =
    orientation === "vertical"
      ? { width: isOpen ? dockSize.expanded : dockSize.collapsed, height: "auto" }
      : { height: isOpen ? dockSize.expanded : dockSize.collapsed, width: "auto" };

  return (
    <div
      ref={dockRef}
      onMouseDown={handleMouseDown}
      className={[
        "dock",
        orientation === "vertical" ? "dock--vertical" : "",
        isOpen ? "" : "dock--drag dock--collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        ...sizeStyle,
      }}
    >
      <button
        type="button"
        className="dock-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Abrir dock"
      >
        {isOpen ? "×" : "≡"}
      </button>
      <div className="dock-items">
        {dockItems.map((item) => (
          <div key={item.key} className="dock-item" title={item.label}>
            <span className="dock-item-icon text-emerald-200/90">
              <item.Icon className="h-4 w-4" />
            </span>
            <span className="dock-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dock;
