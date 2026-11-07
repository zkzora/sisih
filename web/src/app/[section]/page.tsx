import { redirect, notFound } from "next/navigation";

const redirects: Record<string, string> = {
  workspace: "/",
  tour: "/proof",
  obligations: "/proof",
  agent: "/proof",
  memory: "/proof",
  learning: "/proof",
  activity: "/proof",
  settings: "/connect",
};

export function generateStaticParams() {
  return Object.keys(redirects).map((section) => ({ section }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const target = redirects[section];
  if (!target) notFound();
  redirect(target);
}
