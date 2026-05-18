import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
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

const navbar = (
  <Navbar logo={<b>p6t</b>} projectLink="https://github.com/p6t/p6t" />
);

const footer = <Footer>MIT {new Date().getFullYear()} © p6t.</Footer>;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/p6t/p6t/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
