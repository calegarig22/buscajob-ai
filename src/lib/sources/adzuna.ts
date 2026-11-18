import type { FetchedJob } from "./types";
import { guessWorkplace } from "./greenhouse";

type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

/** Agregador (Adzuna Brasil). Opcional: só roda se ADZUNA_APP_ID/ADZUNA_APP_KEY estiverem definidos. */
export async function fetchAdzuna(what: string, where: string): Promise<FetchedJob[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const params = new URLSearchParams({
    app_id: id,
    app_key: key,
    what,
    where,
    results_per_page: "50",
    max_days_old: "14",
    "content-type": "application/json",
  });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/br/search/1?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`adzuna: HTTP ${res.status}`);
  const data = (await res.json()) as { results: AdzunaJob[] };
  return data.results.map((j) => {
    const loc = j.location?.display_name ?? "";
    return {
      id: `adzuna:${j.id}`,
      source: "adzuna",
      company: j.company?.display_name ?? "Empresa não informada",
      title: j.title.replace(/<[^>]+>/g, ""),
      location: loc,
      workplace: guessWorkplace(`${loc} ${j.title} ${j.description}`),
      url: j.redirect_url,
      applyUrl: j.redirect_url,
      description: j.description.replace(/<[^>]+>/g, ""),
      postedAt: new Date(j.created),
    };
  });
}
