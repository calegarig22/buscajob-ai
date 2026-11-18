import type { FetchedJob } from "./types";
import { guessWorkplace } from "./greenhouse";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
};

export async function fetchLever(slug: string, company: string): Promise<FetchedJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`lever ${slug}: HTTP ${res.status}`);
  const data = (await res.json()) as LeverJob[];
  return data.map((j) => {
    const lists = (j.lists ?? [])
      .map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, " ")}`)
      .join("\n\n");
    const description = [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n");
    const loc = j.categories?.allLocations?.join(", ") || j.categories?.location || "";
    const wp = j.workplaceType;
    return {
      id: `lever:${j.id}`,
      source: "lever",
      company,
      title: j.text,
      location: loc,
      workplace:
        wp === "hybrid" ? "hibrido" : wp === "remote" ? "remoto" : wp === "onsite" ? "presencial" : guessWorkplace(`${loc} ${description}`),
      url: j.hostedUrl,
      applyUrl: j.applyUrl,
      description,
      postedAt: new Date(j.createdAt),
    };
  });
}
