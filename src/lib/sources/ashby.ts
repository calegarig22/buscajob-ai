import { stripHtml, type FetchedJob } from "./types";
import { guessWorkplace } from "./greenhouse";

type AshbyJob = {
  id: string;
  title: string;
  location: string;
  secondaryLocations?: { location: string }[];
  workplaceType?: "OnSite" | "Hybrid" | "Remote";
  isListed?: boolean;
  jobUrl: string;
  applyUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
};

export async function fetchAshby(org: string, company: string): Promise<FetchedJob[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${org}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ashby ${org}: HTTP ${res.status}`);
  const data = (await res.json()) as { jobs: AshbyJob[] };
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const loc = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join("; ");
      const description = j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? "");
      return {
        id: `ashby:${j.id}`,
        source: "ashby",
        company,
        title: j.title,
        location: loc,
        workplace:
          j.workplaceType === "Hybrid" ? "hibrido" : j.workplaceType === "Remote" ? "remoto" : j.workplaceType === "OnSite" ? "presencial" : guessWorkplace(loc),
        url: j.jobUrl,
        applyUrl: j.applyUrl,
        description,
        postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
      };
    });
}
