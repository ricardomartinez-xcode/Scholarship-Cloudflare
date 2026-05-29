import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import WorkspaceSidebarIdentitySync from "@/components/app/WorkspaceSidebarIdentitySync";
import "./globals.css";
import "./workspace-ui.css";
import "./workspace-brand-fix.css";
import "./workspace-width-balance.css";
import "./workspace-sidebar-identity.css";
import "./admin-drawer-fix.css";
import "./interface-unification.css";

export const metadata: Metadata = {
  title: "ReCalc",
  icons: {
    icon: [
      { url: "/icons/icon16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  description: "Calculadora de becas y costos académicos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ui-density-compact-desktop antialiased`}
      >
        <WorkspaceSidebarIdentitySync />
        <div>{children}</div>
      </body>
    </html>
  );
}
