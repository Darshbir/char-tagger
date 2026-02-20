import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Character Tagger",
  description: "Tag recurring characters across photos and organize them in Google Drive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
