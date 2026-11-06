import type { Metadata } from "next";
import Feedback from "./components/Feedback";
import "./globals.css";

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
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        {children}
        <Feedback />
      </body>
    </html>
  );
}
