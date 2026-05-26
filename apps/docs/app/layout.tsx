import { Head } from "nextra/components";
import { ReactNode } from "react";
import "../globals.css";

export const metadata = {
  title: {
    default: "p6t - Continuous i18n for React",
    template: "%s | p6t",
  },
  description:
    "Ship every feature in every language—automatically. No translation phase. No release blocking. No dead keys.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  );
}
