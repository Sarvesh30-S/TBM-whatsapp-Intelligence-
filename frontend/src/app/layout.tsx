import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheBoredMonkey | WhatsApp Intelligence Platform",
  description: "Enterprise WhatsApp Communication Intelligence and Group Summarization",
  icons: {
    icon: "/theboredmonkey-tbm-badge.png",
    shortcut: "/theboredmonkey-tbm-badge.png",
    apple: "/theboredmonkey-tbm-badge.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
