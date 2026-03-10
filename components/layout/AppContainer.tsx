import type { ReactNode } from "react";
import layoutStyles from "./layout.module.css";

export function AppContainer({ children }: { children: ReactNode }) {
  return <div className={layoutStyles.container}>{children}</div>;
}
