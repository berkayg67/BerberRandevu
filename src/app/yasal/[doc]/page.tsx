import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalFrame } from "@/components/legal/LegalFrame";
import { getLegalDoc, LEGAL_DOCS } from "@/lib/legal/docs";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/yasal/[doc]">): Promise<Metadata> {
  const doc = getLegalDoc((await params).doc);
  return { title: doc?.title ?? "Yasal" };
}

export default async function LegalPage({ params }: PageProps<"/yasal/[doc]">) {
  const doc = getLegalDoc((await params).doc);
  if (!doc) notFound();
  return <LegalFrame doc={doc} />;
}
