import type { Metadata } from "next";
import { Inter_Tight, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

// Neue Haas Grotesk is licensed and Helvetica Neue cannot be served as a
// webfont, so Inter Tight is the shipped face. The stack in globals.css puts
// Helvetica Neue ahead of it for machines that already have it locally.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
  display: "swap",
});

// An accent, used twice: the testimonial quotation marks and nothing else.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Shrinkless — Organic Tees That Don't Shrink",
    template: "%s — Shrinkless",
  },
  description:
    "Garment dyed organic cotton tees engineered to hold their shape, wash after wash. Made in USA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
