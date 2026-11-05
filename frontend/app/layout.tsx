import type { Metadata } from "next";
import { DM_Mono, Instrument_Sans, Young_Serif } from "next/font/google";
import "./globals.css";

const display = Young_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = DM_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "RAG Q&A",
  description: "An AI agent that answers questions about RAG, using 3,083 research papers from arXiv.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
