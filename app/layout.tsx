import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Unbounded } from "next/font/google";

import { StructuredData } from "@/components/seo/structured-data";
import { getSiteUrl, indexRobots, organizationJsonLd } from "@/lib/seo";
import { companyName, siteDescription } from "@/lib/site-config";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${companyName} | Материалы и сервис для мебельных проектов`,
    template: `%s | ${companyName}`,
  },
  description: siteDescription,
  applicationName: companyName,
  creator: companyName,
  publisher: companyName,
  alternates: {
    canonical: "/",
  },
  robots: indexRobots,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: `${companyName} | Материалы и сервис для мебельных проектов`,
    description: siteDescription,
    url: "/",
    siteName: companyName,
    locale: "ru_KG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${companyName} | Материалы и сервис для мебельных проектов`,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${unbounded.variable} ${ibmPlexMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        <a href="#main-content" className="skip-link">
          Перейти к основному контенту
        </a>
        <StructuredData data={organizationJsonLd()} />
        {children}
      </body>
    </html>
  );
}
