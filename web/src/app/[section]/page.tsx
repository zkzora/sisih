import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import { Skeleton } from "@/components/ui";
import type { View } from "@/lib/types";
const sections = [
  "obligations",
  "agent",
  "memory",
  "learning",
  "activity",
  "settings",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <DashboardView view={section as View} />
    </Suspense>
  );
}
