import type { Metadata, Viewport } from "next";
import "./globals.css";
import NextAuthProvider from "@/components/NextAuthProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('tbm-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <NextAuthProvider>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
