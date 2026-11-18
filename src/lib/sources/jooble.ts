import type { FetchedJob } from "./types";
import { guessWorkplace } from "./greenhouse";

type JoobleJob = {
  id: number | string;
  title: string;
  location?: string;
  snippet?: string;
  company?: string;
  link: string;
  updated?: string;
  source?: string;
};

/** Agregador Jooble (Brasil). Só roda com JOOBLE_API_KEY. */
export async function fetchJooble(keywords: string, location: string, page = 1): Promise<FetchedJob[]> {
  const key = process.env.JOOBLE_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch(`https://br.jooble.org/api/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, location, page: String(page) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`jooble: HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: JoobleJob[] };
  return (data.jobs ?? []).map((j) => {
    const clean = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    const loc = clean(j.location);
    const description = clean(j.snippet);
    return {
      id: `jooble:${j.id}`,
      source: "jooble",
      company: clean(j.company) || "Empresa não informada",
      title: clean(j.title),
      location: loc,
      workplace: guessWorkplace(`${loc} ${j.title} ${description}`),
      url: j.link,
      applyUrl: j.link,
      description,
      postedAt: j.updated ? new Date(j.updated) : null,
    };
  });
}
