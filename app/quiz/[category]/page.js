import { notFound } from "next/navigation";
import { categories, getCategory } from "@/data/questions";
import QuizRunner from "@/components/QuizRunner";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export default async function QuizPage({ params }) {
  const { category: slug } = await params;
  const category = getCategory(slug);

  if (!category) notFound();

  return <QuizRunner category={category} />;
}
