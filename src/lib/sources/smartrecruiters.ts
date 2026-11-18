import { stripHtml, type FetchedJob } from "./types";

type SrPosting = {
  id: string;
  name: string;
  releasedDate?: string;
  company: { identifier: string; name: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean };
};

/** Lista vagas no Brasil (sem descrição; ela vem em hydrateSmartRecruiters só para as que passam no filtro). */
export async function fetchSmartRecruiters(companyId: string, company: string): Promise<FetchedJob[]> {
  const out: FetchedJob[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const res = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${companyId}/postings?country=br&limit=100&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`smartrecruiters ${companyId}: HTTP ${res.status}`);
    const data = (await res.json()) as { content: SrPosting[]; totalFound: number };
    for (const p of data.content) {
      const url = `https://jobs.smartrecruiters.com/${p.company.identifier}/${p.id}`;
      out.push({
        id: `smartrecruiters:${p.id}`,
        source: "smartrecruiters",
        company,
        title: p.name,
        location: [p.location?.city, p.location?.region, "Brasil"].filter(Boolean).join(", "),
        workplace: p.location?.remote ? "remoto" : p.location?.hybrid ? "hibrido" : "presencial",
        url,
        applyUrl: url,
        description: "",
        postedAt: p.releasedDate ? new Date(p.releasedDate) : null,
      });
    }
    if (offset + 100 >= data.totalFound) break;
  }
  return out;
}

export async function hydrateSmartRecruiters(job: FetchedJob, companyId: string): Promise<FetchedJob> {
  const id = String(job.id).split(":")[1];
  try {
    const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${companyId}/postings/${id}`, { cache: "no-store" });
    if (!res.ok) return job;
    const d = (await res.json()) as {
      applyUrl?: string;
      postingUrl?: string;
      jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
    };
    const sections = Object.values(d.jobAd?.sections ?? {})
      .map((s) => `${s.title ?? ""}\n${stripHtml(s.text ?? "")}`)
      .join("\n\n");
    return { ...job, description: sections, url: d.postingUrl ?? job.url, applyUrl: d.applyUrl ?? job.applyUrl };
  } catch {
    return job;
  }
}
