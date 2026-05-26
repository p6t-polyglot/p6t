import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { ReactNode } from "react";

const navbar = (
  <Navbar logo={<b>p6t</b>} projectLink="https://github.com/p6t/p6t" />
);

const footer = <Footer>MIT {new Date().getFullYear()} © p6t.</Footer>;

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Layout
      navbar={navbar}
      pageMap={await getPageMap()}
      docsRepositoryBase="https://github.com/p6t/p6t/tree/main/apps/docs"
      footer={footer}
    >
      {children}
    </Layout>
  );
}
