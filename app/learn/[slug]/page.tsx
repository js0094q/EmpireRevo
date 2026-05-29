import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findLearnArticle, learnArticles } from "../content";
import styles from "../../legal.module.css";

export function generateStaticParams() {
  return learnArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = findLearnArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description
  };
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findLearnArticle(slug);
  if (!article) notFound();

  return (
    <main className={styles.legalPage}>
      <Link className={styles.inlineLink} href="/learn">
        Back to guides
      </Link>
      <h1 className={styles.legalTitle}>{article.title}</h1>
      <p className={styles.legalLead}>{article.description}</p>
      {article.sections.map((section) => (
        <section key={section.heading} className={styles.legalSection}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
