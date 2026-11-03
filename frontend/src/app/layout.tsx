import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Messages Dashboard",
  description: "Messages Sent and Received",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
