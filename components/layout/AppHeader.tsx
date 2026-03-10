import Link from "next/link";
import layoutStyles from "./layout.module.css";

type AppHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export function AppHeader({ eyebrow, title, subtitle, breadcrumbs }: AppHeaderProps) {
  return (
    <header className={layoutStyles.header}>
      <div className={layoutStyles.headerInner}>
        <div className={layoutStyles.brand}>
          <span className={layoutStyles.eyebrow}>{eyebrow}</span>
          <h1 className={layoutStyles.title}>{title}</h1>
          <p className={layoutStyles.subtitle}>{subtitle}</p>
        </div>
        {breadcrumbs?.length ? (
          <nav className={layoutStyles.crumbs} aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) =>
              crumb.href ? (
                <Link key={`${crumb.label}-${index}`} href={crumb.href}>
                  {crumb.label}
                </Link>
              ) : (
                <span key={`${crumb.label}-${index}`}>{crumb.label}</span>
              )
            )}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
