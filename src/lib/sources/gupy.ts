import { stripHtml, type FetchedJob } from "./types";

// Páginas públicas de carreira da Gupy ({empresa}.gupy.io): a lista de vagas vem no __NEXT_DATA__ da página.
type GupyListJob = {
  id: number;
  title: string;
  workplace?: {
    workplaceType?: "on-site" | "hybrid" | "remote";
    address?: { city?: string; state?: string; stateShortName?: string; country?: string };
  };
};

function nextData(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

/** Data de hoje no fuso de São Paulo (AAAA-MM-DD). */
export const todayBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const WP = { "on-site": "presencial", hybrid: "hibrido", remote: "remoto" } as const;

export async function fetchGupy(sub: string, company: string): Promise<FetchedJob[]> {
  const res = await fetch(`https://${sub}.gupy.io/`, { cache: "no-store" });
  if (!res.ok) throw new Error(`gupy ${sub}: HTTP ${res.status}`);
  const d = nextData(await res.text()) as { props?: { pageProps?: { jobs?: GupyListJob[] } } } | null;
  const list = d?.props?.pageProps?.jobs ?? [];
  return list.map((j) => {
    const a = j.workplace?.address;
    const url = `https://${sub}.gupy.io/jobs/${j.id}`;
    return {
      id: `gupy:${j.id}`,
      source: "gupy",
      company,
      title: j.title,
      location: [a?.city, a?.stateShortName ?? a?.state, a?.country].filter(Boolean).join(", "),
      workplace: WP[j.workplace?.workplaceType ?? "on-site"] ?? "presencial",
      url,
      applyUrl: url,
      description: "", // vem em hydrateGupy, só para as vagas que passam no filtro
      postedAt: null,
    };
  });
}

/** Busca a descrição completa e a data de publicação da vaga. */
export async function hydrateGupy(job: FetchedJob): Promise<FetchedJob> {
  try {
    const res = await fetch(job.url, { cache: "no-store" });
    if (!res.ok) return job;
    const d = nextData(await res.text()) as {
      props?: { pageProps?: { job?: Record<string, string | null> } };
    } | null;
    const j = d?.props?.pageProps?.job;
    if (!j) return job;
    const parts: [string, string | null | undefined][] = [
      ["", j.description],
      ["Responsabilidades", j.responsibilities],
      ["Requisitos", j.prerequisites],
      ["Diferenciais", j.relevantExperiences],
    ];
    const description = parts
      .filter(([, v]) => v)
      .map(([t, v]) => `${t ? t + "\n" : ""}${stripHtml(v!)}`)
      .join("\n\n");
    // vaga ativa: publicada e com inscrições abertas (registerEndDate é o último dia, inclusive)
    const deadline = j.registerEndDate ? String(j.registerEndDate).slice(0, 10) : null;
    const inactive = (j.status && j.status !== "published") || (deadline !== null && deadline < todayBR());
    return { ...job, description, deadline, inactive, postedAt: j.publishedAt ? new Date(j.publishedAt) : job.postedAt };
  } catch {
    return job;
  }
}
