type ExternalEvidence = {
  sourceName: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  matchedTerms: string[];
};

type ExternalEvidenceResult = {
  evidences: ExternalEvidence[];
  whitelist: string[];
};
type RetrieveOptions = {
  maxEvidence?: number;
  maxDomains?: number;
};

const DEFAULT_WHITELIST = [
  "nhso.go.th",
  "moph.go.th",
  "dms.go.th",
  "hiso.or.th",
  "tmc.or.th",
  "rcpt.org",
  "ratchakitcha.soc.go.th",
  "mahidol.ac.th",
  "chula.ac.th",
  "cmu.ac.th",
  "kku.ac.th",
  "psu.ac.th",
  "tu.ac.th",
  "msu.ac.th",
  "medicine.si.mahidol.ac.th",
  "rama.mahidol.ac.th",
  "med.cmu.ac.th",
  "med.cu.ac.th",
  "med.kku.ac.th",
  "medicine.psu.ac.th",
  "sirirajhospital.com",
  "ramathibodi.org",
  "saovabha.com",
  "chulalongkornhospital.go.th",
  "rajavithi.go.th",
  "bhumibolhospital.rtaf.mi.th",
  "tropmedhospital.com",
  "rcrt.or.th",
  "rheumatology.or.th",
  "thaipediatrics.org",
  "rcost.or.th",
  "rtdrc.org",
  "ortho.or.th",
  "rcpsycht.org",
  "rtco.or.th",
  "thaiobgyn.org",
  "thaient.com",
  "thailandophthalmology.org",
  "thairedcross.org",
  "who.int",
  "cdc.gov",
  "nice.org.uk",
  "idsociety.org",
];

const TOXICOLOGY_PRIORITY_DOMAINS = [
  "rama.mahidol.ac.th",
  "saovabha.com",
  "moph.go.th",
  "who.int",
  "cdc.gov",
];

const TRAUMA_PRIORITY_DOMAINS = [
  "moph.go.th",
  "dms.go.th",
  "rcpt.org",
  "ratchakitcha.soc.go.th",
  "who.int",
  "nice.org.uk",
];

const STROKE_FASTTRACK_PRIORITY_DOMAINS = [
  "moph.go.th",
  "dms.go.th",
  "rcpt.org",
  "who.int",
  "nice.org.uk",
  "cdc.gov",
];

const MI_FASTTRACK_PRIORITY_DOMAINS = [
  "moph.go.th",
  "dms.go.th",
  "rcpt.org",
  "who.int",
  "nice.org.uk",
  "idsociety.org",
];

function isThaiPriorityDomain(domain: string) {
  return /(\.go\.th|\.or\.th|\.ac\.th)$/.test(domain) || /ramathibodi|siriraj|mahidol|chula|cmu|kku|psu|ratchakitcha/.test(domain);
}

function isToxicologyQuery(question: string) {
  const q = question.toLowerCase();
  return /(พิษ|สารพิษ|ได้รับพิษ|poison|poisoning|toxic|toxicity|overdose|antidote|พิษวิทยา)/.test(q);
}

function isTraumaQuery(question: string) {
  const q = question.toLowerCase();
  return /(trauma|polytrauma|บาดเจ็บ|อุบัติเหตุ|ชน|ตกจากที่สูง|head injury|tbi|เลือดออกภายใน|fast track trauma)/.test(q);
}

function isStrokeFastTrackQuery(question: string) {
  const q = question.toLowerCase();
  return /(stroke|cva|fast track stroke|stroke fast track|สมองขาดเลือด|อัมพาตเฉียบพลัน|แขนขาอ่อนแรงเฉียบพลัน|พูดไม่ชัด)/.test(
    q
  );
}

function isMiFastTrackQuery(question: string) {
  const q = question.toLowerCase();
  return /(mi|stemi|nstemi|acs|fast track mi|mi fast track|กล้ามเนื้อหัวใจขาดเลือด|เจ็บหน้าอกเฉียบพลัน)/.test(q);
}

function isEmergencyFastTrackQuery(question: string) {
  return isTraumaQuery(question) || isStrokeFastTrackQuery(question) || isMiFastTrackQuery(question);
}

function buildPrioritizedWhitelist(question: string, whitelist: string[]) {
  const picks: string[] = [];
  if (isToxicologyQuery(question)) picks.push(...TOXICOLOGY_PRIORITY_DOMAINS);
  if (isTraumaQuery(question)) picks.push(...TRAUMA_PRIORITY_DOMAINS);
  if (isStrokeFastTrackQuery(question)) picks.push(...STROKE_FASTTRACK_PRIORITY_DOMAINS);
  if (isMiFastTrackQuery(question)) picks.push(...MI_FASTTRACK_PRIORITY_DOMAINS);
  const uniquePicks = Array.from(new Set(picks)).filter((d) => whitelist.includes(d));
  if (!uniquePicks.length) return whitelist;
  const thaiSeed = uniquePicks.filter((d) => isThaiPriorityDomain(d));
  const globalSeed = uniquePicks.filter((d) => !isThaiPriorityDomain(d));
  const remainingThai = whitelist.filter((d) => !uniquePicks.includes(d) && isThaiPriorityDomain(d));
  const remainingGlobal = whitelist.filter((d) => !uniquePicks.includes(d) && !isThaiPriorityDomain(d));
  if (isEmergencyFastTrackQuery(question) || isToxicologyQuery(question)) {
    return [...thaiSeed, ...remainingThai, ...globalSeed, ...remainingGlobal];
  }
  return [...uniquePicks, ...remainingThai, ...remainingGlobal];
}

function buildSearchQuery(question: string) {
  const base = question.trim().slice(0, 220);
  if (!base) return "";
  if (isStrokeFastTrackQuery(base)) {
    return `${base} แนวทางล่าสุด ประเทศไทย stroke fast track guideline`;
  }
  if (isMiFastTrackQuery(base)) {
    return `${base} แนวทางล่าสุด ประเทศไทย STEMI NSTEMI fast track guideline`;
  }
  if (isTraumaQuery(base)) {
    return `${base} แนวทางล่าสุด ประเทศไทย trauma fast track guideline`;
  }
  if (isToxicologyQuery(base)) {
    return `${base} แนวทางล่าสุด ประเทศไทย พิษวิทยา poison center guideline`;
  }
  return base;
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function getWhitelistDomains() {
  const env = String(process.env.REFERENCE_SOURCE_WHITELIST || "").trim();
  if (!env) return DEFAULT_WHITELIST;
  return env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function extractCandidateUrls(raw: string, domain: string) {
  const re = new RegExp(`https?:\\/\\/(?:www\\.)?${domain.replace(".", "\\.")}[^\\s)"'<>]*`, "gi");
  const matches = raw.match(re) || [];
  return Array.from(new Set(matches)).slice(0, 2);
}

function extractTitleFromMarkdown(md: string, fallback: string) {
  const line = md
    .split("\n")
    .map((x) => x.trim())
    .find((x) => x.startsWith("# "));
  return line ? line.replace(/^#\s+/, "").slice(0, 140) : fallback;
}

function getMatchedTerms(question: string, content: string) {
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9ก-๙]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 12);
  const c = content.toLowerCase();
  return words.filter((w) => c.includes(w)).slice(0, 6);
}

async function fetchText(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieveExternalEvidence(question: string, options?: RetrieveOptions): Promise<ExternalEvidenceResult> {
  const trimmed = question.trim();
  const whitelist = getWhitelistDomains();
  const prioritizedWhitelist = buildPrioritizedWhitelist(trimmed, whitelist);
  if (!trimmed) return { evidences: [], whitelist };
  const maxEvidence = Math.max(1, Math.min(8, Number(options?.maxEvidence || 4)));
  const maxDomains = Math.max(1, Math.min(10, Number(options?.maxDomains || 5)));

  const query = encodeURIComponent(buildSearchQuery(trimmed));
  const evidences: ExternalEvidence[] = [];

  for (const domain of prioritizedWhitelist.slice(0, maxDomains)) {
    const ddgUrl = `https://r.jina.ai/http://duckduckgo.com/html/?q=site:${encodeURIComponent(domain)}+${query}`;
    const ddgText = await fetchText(ddgUrl, 9000);
    if (!ddgText) continue;

    const urls = extractCandidateUrls(ddgText, domain);
    for (const sourceUrl of urls) {
      if (evidences.length >= maxEvidence) break;
      const page = await fetchText(`https://r.jina.ai/http://${sourceUrl.replace(/^https?:\/\//, "")}`, 12000);
      if (!page) continue;
      const matchedTerms = getMatchedTerms(trimmed, page);
      if (matchedTerms.length === 0) continue;
      evidences.push({
        sourceName: domain,
        sourceUrl,
        title: extractTitleFromMarkdown(page, sourceUrl),
        snippet: cleanText(page).slice(0, 600),
        matchedTerms,
      });
    }
    if (evidences.length >= maxEvidence) break;
  }

  return { evidences, whitelist: prioritizedWhitelist };
}

export function extractIcd10Candidates(text: string) {
  const hits = text.match(/\b[A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?\b/g) || [];
  return Array.from(new Set(hits)).slice(0, 12);
}
