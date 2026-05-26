import { ReactNode } from "react";
import "../../globals.css";

export default function LandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
