import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collaborative Documents",
  description: "Backend-first collaborative document editor"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
