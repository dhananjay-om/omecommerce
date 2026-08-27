import type { Metadata } from "next";
import { Geist_Mono, Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteLayout } from "@/components/layouts/site-layout";
import { SITE_URL } from "@/lib/config";

// ÉLUME restyle: Outfit (body/UI) + Playfair Display (editorial headings),
// replacing Geist — see the storefront restyle plan's Decision 3. Geist
// Mono stays wired for any monospace use (order numbers, etc.).
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "OMEShop";
const SITE_DESCRIPTION = "Everything you need, delivered fast. Quality products, honest prices.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteLayout>{children}</SiteLayout>
        </Providers>
      </body>
    </html>
  );
}
