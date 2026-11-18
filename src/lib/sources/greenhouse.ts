import { stripHtml, type FetchedJob } from "./types";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location?: { name: string };
  content?: string;
};

export async function fetchGreenhouse(slug: string, company: string, withContent = true): Promise<FetchedJob[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs${withContent ? "?content=true" : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`greenhouse ${slug}: HTTP ${res.status}`);
  const data = (await res.json()) as { jobs: GhJob[] };
  return data.jobs.map((j) => {
    const description = stripHtml(j.content ?? "");
    const loc = j.location?.name ?? "";
    return {
      id: `greenhouse:${j.id}`,
      source: "greenhouse",
      company,
      title: j.title,
      location: loc,
      workplace: guessWorkplace(`${loc} ${j.title} ${description.slice(0, 2000)}`),
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      description,
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    };
  });
}

export function guessWorkplace(text: string): string {
  const t = text.toLowerCase();
  if (/h[ií]brid|hybrid/.test(t)) return "hibrido";
  if (/remot|remote|home office/.test(t)) return "remoto";
  return "presencial";
}
