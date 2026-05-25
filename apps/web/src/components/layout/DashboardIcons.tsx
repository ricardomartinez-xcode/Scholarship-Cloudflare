"use client";

import { useState } from "react";
import Image from "next/image";

export type DashboardIconName =
  | "menu"
  | "close"
  | "more"
  | "chevron-left"
  | "chevron-right"
  | "calculator"
  | "whatsapp"
  | "calendar"
  | "contacts"
  | "inbox"
  | "web"
  | "history"
  | "offer"
  | "price"
  | "plan"
  | "directory"
  | "campus"
  | "summary"
  | "benefits"
  | "programs"
  | "simulator"
  | "announcement"
  | "sidebar"
  | "template"
  | "cta"
  | "extension"
  | "invitation"
  | "users"
  | "organization"
  | "training"
  | "report"
  | "audit"
  | "sync";

function IconWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
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
      {children}
    </svg>
  );
}

function CalculatorIconWithImage({ className }: { className?: string }) {
  const [showImage, setShowImage] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (showImage && !imageError) {
    return (
      <Image
        src="/icons/icono-calculadora.png"
        alt="Cotizador"
        width={24}
        height={24}
        className={className}
        onError={() => {
          setImageError(true);
          setShowImage(false);
        }}
        style={{ objectFit: "contain" }}
      />
    );
  }

  return (
    <IconWrap className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M8.5 7.5h7M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </IconWrap>
  );
}

export function DashboardIcon({
  name,
  className,
}: {
  name: DashboardIconName;
  className?: string;
}) {
  switch (name) {
    case "menu":
      return (
        <IconWrap className={className}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </IconWrap>
      );
    case "close":
      return (
        <IconWrap className={className}>
          <path d="m6 6 12 12M18 6 6 18" />
        </IconWrap>
      );
    case "more":
      return (
        <IconWrap className={className}>
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="19" cy="12" r="1.2" />
        </IconWrap>
      );
    case "chevron-left":
      return (
        <IconWrap className={className}>
          <path d="m15 18-6-6 6-6" />
        </IconWrap>
      );
    case "chevron-right":
      return (
        <IconWrap className={className}>
          <path d="m9 18 6-6-6-6" />
        </IconWrap>
      );
    case "calculator":
      return <CalculatorIconWithImage className={className} />;
    case "whatsapp":
      return (
        <IconWrap className={className}>
          <path d="M20 11.4a8 8 0 0 1-11.6 7.1L4 20l1.6-4.1A8 8 0 1 1 20 11.4Z" />
          <path d="M9.5 8.7c.3-.6.6-.6.8-.6h.6c.2 0 .4 0 .5.5.1.4.5 1.5.6 1.6.1.2.1.3 0 .5-.1.2-.2.3-.4.5-.2.2-.3.3-.1.6.2.3.8 1.4 1.8 2.3 1.2 1.1 2.1 1.4 2.4 1.6.3.1.4.1.6-.1.2-.2.7-.8.9-1 .2-.2.3-.2.6-.1.2.1 1.5.7 1.7.8.2.1.4.2.4.3" />
        </IconWrap>
      );
    case "calendar":
      return (
        <IconWrap className={className}>
          <path d="M7 3.5v3M17 3.5v3M4 8.5h16" />
          <rect x="4" y="5.5" width="16" height="15" rx="3" />
          <path d="M8 12h3M13 12h3M8 16h3" />
        </IconWrap>
      );
    case "contacts":
      return (
        <IconWrap className={className}>
          <rect x="4.5" y="4" width="15" height="16" rx="3" />
          <path d="M8 9.8a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 0 0-4.6 0ZM8 16c.8-1.2 1.9-1.8 3.1-1.8s2.2.6 3 1.8M16 9h1.5M16 13h1.5" />
        </IconWrap>
      );
    case "inbox":
      return (
        <IconWrap className={className}>
          <path d="M4 7.5h16v9.8a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.3V7.5Z" />
          <path d="M4 12h4.5l1.5 2h4l1.5-2H20" />
        </IconWrap>
      );
    case "web":
      return (
        <IconWrap className={className}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <path d="M3.5 8.5h17M8 6.5h.01M11.5 6.5h.01M15 6.5h.01M8 13h8M8 16.5h5" />
        </IconWrap>
      );
    case "history":
      return (
        <IconWrap className={className}>
          <path d="M4 12a8 8 0 1 0 2.3-5.6" />
          <path d="M4 4v5h5M12 8v4l2.5 1.5" />
        </IconWrap>
      );
    case "offer":
      return (
        <IconWrap className={className}>
          <path d="M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Z" />
          <path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
        </IconWrap>
      );
    case "price":
      return (
        <IconWrap className={className}>
          <path d="M12 3.5v17M16 7.5c0-1.2-1.6-2.2-3.7-2.2-2 0-3.6.8-3.6 2.2 0 3.6 7.3 1.8 7.3 5.4 0 1.4-1.6 2.3-3.8 2.3-2.1 0-3.7-1-3.7-2.3" />
        </IconWrap>
      );
    case "plan":
      return (
        <IconWrap className={className}>
          <path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </IconWrap>
      );
    case "directory":
      return (
        <IconWrap className={className}>
          <path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" />
          <path d="M7 8h1.5M7 12h1.5M7 16h1.5M10.5 8h6M10.5 12h6M10.5 16h6" />
        </IconWrap>
      );
    case "campus":
      return (
        <IconWrap className={className}>
          <path d="m4 19.5 8-4 8 4V9.5L12 5 4 9.5v10Z" />
          <path d="M12 5v10.5M8.5 11h.01M12 11h.01M15.5 11h.01" />
        </IconWrap>
      );
    case "summary":
      return (
        <IconWrap className={className}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </IconWrap>
      );
    case "benefits":
      return (
        <IconWrap className={className}>
          <path d="M12 20s-6.5-4.1-6.5-9.5A3.5 3.5 0 0 1 9 7c1.4 0 2.4.7 3 1.8.6-1.1 1.6-1.8 3-1.8a3.5 3.5 0 0 1 3.5 3.5C18.5 15.9 12 20 12 20Z" />
        </IconWrap>
      );
    case "programs":
      return (
        <IconWrap className={className}>
          <path d="M4.5 6.5h7a2 2 0 0 1 2 2v11h-7a2 2 0 0 0-2 2v-15Z" />
          <path d="M19.5 6.5h-7a2 2 0 0 0-2 2v11h7a2 2 0 0 1 2 2v-15Z" />
        </IconWrap>
      );
    case "simulator":
      return (
        <IconWrap className={className}>
          <rect x="3.5" y="5" width="17" height="11" rx="2.5" />
          <path d="M8 19.5h8M12 16v3.5" />
        </IconWrap>
      );
    case "announcement":
      return (
        <IconWrap className={className}>
          <path d="M4 11.5 18 6v12l-14-5V11.5Z" />
          <path d="M4 11.5v4a2 2 0 0 0 2 2h1.5" />
          <path d="M20 9c.8.6 1.3 1.6 1.3 3S20.8 14.4 20 15" />
        </IconWrap>
      );
    case "sidebar":
      return (
        <IconWrap className={className}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <path d="M9 4.5v15M12.5 9h5M12.5 13h4" />
        </IconWrap>
      );
    case "template":
      return (
        <IconWrap className={className}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 8h8M8 12h4M8 16h8" />
        </IconWrap>
      );
    case "cta":
      return (
        <IconWrap className={className}>
          <path d="M4 12h16M14 6l6 6-6 6" />
        </IconWrap>
      );
    case "extension":
      return (
        <IconWrap className={className}>
          <path d="M10 4.5h4v4h-4zM5 9.5h4v4H5zM15 9.5h4v4h-4zM10 14.5h4v4h-4z" />
        </IconWrap>
      );
    case "invitation":
      return (
        <IconWrap className={className}>
          <path d="M4 7.5 12 13l8-5.5" />
          <rect x="4" y="6" width="16" height="12" rx="2.5" />
        </IconWrap>
      );
    case "users":
      return (
        <IconWrap className={className}>
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 19a5 5 0 0 1 9 0M14 19a4 4 0 0 1 6 0" />
        </IconWrap>
      );
    case "organization":
      return (
        <IconWrap className={className}>
          <path d="M5 19.5V8.5L12 5l7 3.5v11" />
          <path d="M8 19.5v-4h8v4M8.5 10h.01M12 10h.01M15.5 10h.01" />
        </IconWrap>
      );
    case "training":
      return (
        <IconWrap className={className}>
          <path d="m4 9 8-4 8 4-8 4-8-4Z" />
          <path d="M7 11.5v3.2c0 1.7 2.2 3.3 5 3.3s5-1.6 5-3.3v-3.2" />
          <path d="M20 10v5" />
        </IconWrap>
      );
    case "report":
      return (
        <IconWrap className={className}>
          <path d="M5 18.5h14M7.5 15V10M12 15V7M16.5 15v-4" />
        </IconWrap>
      );
    case "audit":
      return (
        <IconWrap className={className}>
          <path d="M10.5 18.5a7 7 0 1 1 5-2.1l3 3" />
          <path d="M10.5 8.5v4l2.5 1.5" />
        </IconWrap>
      );
    case "sync":
      return (
        <IconWrap className={className}>
          <path d="M20 6v5h-5M4 18v-5h5" />
          <path d="M6.7 9A7 7 0 0 1 18 8M17.3 15A7 7 0 0 1 6 16" />
        </IconWrap>
      );
    default:
      return null;
  }
}
