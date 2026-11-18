import type { FetchedJob } from "./types";
import { guessWorkplace } from "./greenhouse";
import { pickApplyUrl } from "./apply-link";

type GJob = {
  job_id: string;
  title: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  share_link?: string;
  apply_options?: { title: string; link: string }[];
  detected_extensions?: { posted_at?: string; work_from_home?: boolean };
};

function postedFrom(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*(hora|hour|dia|day|semana|week|mês|mes|month)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const h = /hora|hour/.test(unit) ? 1 : /dia|day/.test(unit) ? 24 : /semana|week/.test(unit) ? 168 : 720;
  return new Date(Date.now() - n * h * 3600 * 1000);
}

/**
 * Google Vagas (Google for Jobs) via SerpApi: reúne anúncios de LinkedIn, Indeed, Glassdoor, Catho, Gupy etc.
 * Só roda com SERPAPI_KEY. Cada chamada consome 1 busca da cota do SerpApi.
 */
export async function fetchGoogleJobs(q: string, location: string): Promise<FetchedJob[]> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) return [];
  const params = new URLSearchParams({
    engine: "google_jobs",
    q,
    gl: "br",
    hl: "pt",
    api_key: key,
  });
  if (location) params.set("location", `${location}, Brazil`);
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`google jobs: HTTP ${res.status}`);
  const data = (await res.json()) as { jobs_results?: GJob[]; error?: string };
  if (data.error && !/hasn't returned any results/i.test(data.error)) throw new Error(`google jobs: ${data.error}`);
  return (data.jobs_results ?? []).map((j) => {
    const links = (j.apply_options ?? []).map((o) => o.link);
    const apply = pickApplyUrl(links) ?? j.share_link ?? "";
    const loc = j.location ?? "";
    const description = j.description ?? "";
    return {
      id: `google:${j.job_id.slice(0, 180)}`,
      source: j.via ? `google (${j.via.replace(/^via\s+/i, "")})` : "google",
      company: j.company_name ?? "Empresa não informada",
      title: j.title,
      location: loc,
      workplace: j.detected_extensions?.work_from_home ? "remoto" : guessWorkplace(`${loc} ${j.title} ${description.slice(0, 1500)}`),
      url: j.share_link ?? apply,
      applyUrl: apply,
      description,
      postedAt: postedFrom(j.detected_extensions?.posted_at),
    };
  });
}
