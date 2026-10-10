import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { UpdateBanner } from "@/components/update-banner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "EDGEFORGE — Master your edge", template: "%s · EDGEFORGE" },
  description: "Trading intelligence platform: an accurate trade journal, analytics and insights traceable to your own data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <UpdateBanner />
      </body>
    </html>
  );
}
