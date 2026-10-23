import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicKnowledgeSlugs, getPublicKnowledgeTopic } from "@/lib/knowledge-seo";

const SITE_URL = "https://dischargex.net";

export function generateStaticParams() {
  return getPublicKnowledgeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getPublicKnowledgeTopic(slug);
  if (!topic) return { title: "ไม่พบหัวข้อความรู้", robots: { index: false, follow: false } };
  const title = `${topic.name} | แนวทางทบทวนรหัสโรค`;
  const description = `หัวข้ออ้างอิงสำหรับทบทวน ${topic.name} และรหัสที่เกี่ยวข้องจากแคตตาล็อกความรู้ DischargeX`;
  const url = `${SITE_URL}/knowledge/${topic.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "DischargeX", locale: "th_TH", type: "article" },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </section>
  );
}

export default async function KnowledgeTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getPublicKnowledgeTopic(slug);
  if (!topic) notFound();
  const relatedTopics = topic.seeAlso.map(getPublicKnowledgeTopic).filter((item) => item !== null);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "คลังความรู้", item: `${SITE_URL}/knowledge` },
      { "@type": "ListItem", position: 3, name: topic.name, item: `${SITE_URL}/knowledge/${topic.slug}` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#081120] px-4 py-10 text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <article className="mx-auto max-w-4xl space-y-6">
        <nav aria-label="เส้นทางนำทาง" className="text-sm text-slate-400">
          <Link href="/" className="hover:text-cyan-300">หน้าแรก</Link>
          <span className="px-2">/</span>
          <Link href="/knowledge" className="hover:text-cyan-300">คลังความรู้</Link>
          <span className="px-2">/</span>
          <span aria-current="page" className="text-slate-200">{topic.name}</span>
        </nav>

        <header className="rounded-3xl border border-cyan-900/70 bg-slate-900/80 p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">คลังความรู้ DischargeX</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{topic.name}</h1>
          {topic.aliases.length > 0 && <p className="mt-3 text-sm text-slate-400">คำค้นที่เกี่ยวข้อง: {topic.aliases.join(" · ")}</p>}
        </header>

        <ListSection title="คำวินิจฉัยและรหัสที่เกี่ยวข้อง" items={[...topic.diagnosisToWrite, ...topic.icd10.map((code) => `ICD-10: ${code}`)]} />
        <ListSection title="ประเด็นจากแคตตาล็อกที่ควรทบทวน" items={topic.thinkWhen} />
        <ListSection title="เอกสารอ้างอิงในแคตตาล็อก" items={topic.references.map((reference) => `${reference.id} — ${reference.title}${reference.year ? ` (${reference.year})` : ""}`)} />

        {relatedTopics.length > 0 && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">หัวข้อที่เกี่ยวข้อง</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {relatedTopics.map((related) => (
                <li key={related.slug}><Link className="inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-sm text-cyan-200 hover:border-cyan-500" href={`/knowledge/${related.slug}`}>{related.name}</Link></li>
              ))}
            </ul>
          </section>
        )}

        <p className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
          เนื้อหานี้มาจากแคตตาล็อกอ้างอิงของ DischargeX ใช้เพื่อช่วยทบทวนเท่านั้น โปรดตรวจสอบกับเวชระเบียนต้นฉบับและแนวทางฉบับเต็มก่อนใช้งานจริง
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/summary-charge" className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500">ลองใช้งาน</Link>
          <Link href="/pricing" className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold hover:border-cyan-500">ดูแพ็กเกจ</Link>
        </div>
      </article>
    </main>
  );
}
