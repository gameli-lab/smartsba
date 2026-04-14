import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalHeader } from "@/components/layout/global-header";
import { GlobalFooter } from "@/components/layout/global-footer";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider";
import { getSessionTimeoutMinutes } from "@/lib/session-timeout";

export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartSBA - School-Based Assessment System",
  description:
    "Modern school assessment system for managing student grades, tracking progress, and generating comprehensive reports.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionTimeoutMinutes = await getSessionTimeoutMinutes()

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const saved = localStorage.getItem('theme');
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldUseDark = saved ? saved === 'dark' : systemDark;
                document.documentElement.classList.toggle('dark', shouldUseDark);
              } catch {}
            })();`,
          }}
        />
        <ThemeProvider>
          <SessionTimeoutProvider timeoutMinutes={sessionTimeoutMinutes}>
            <GlobalHeader />
            <main className="flex-1">{children}</main>
            <GlobalFooter />
          </SessionTimeoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
