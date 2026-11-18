import "server-only";
import type { Job } from "@/db/schema";
import { todayBR } from "./sources/gupy";

export type Liveness = "aberta" | "encerrada" | "desconhecido";

const get = (url: string, init?: RequestInit) =>
  fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000), ...init });

/** Confere AGORA, no site da empresa, se a vaga ainda está aberta. Na dúvida (erro de rede), "desconhecido". */
export async function checkLive(job: Pick<Job, "id" | "source" | "url" | "company">): Promise<Liveness> {
  const ext = job.id.split(":").slice(1).join(":");
  try {
    switch (job.source) {
      case "gupy": {
        const r = await get(job.url, { redirect: "manual" });
        if (r.status >= 300 && r.status < 400) return "encerrada"; // vaga removida redireciona para a lista
        if (r.status === 404 || r.status === 410) return "encerrada";
        const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        const j = m ? JSON.parse(m[1])?.props?.pageProps?.job : null;
        if (!j) return "encerrada";
        const deadline = j.registerEndDate ? String(j.registerEndDate).slice(0, 10) : null;
        if (j.status !== "published" || (deadline && deadline < todayBR())) return "encerrada";
        return "aberta";
      }
      case "greenhouse": {
        const slug = new URL(job.url).pathname.split("/").filter(Boolean)[0];
        const r = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${ext}`);
        return r.ok ? "aberta" : r.status === 404 ? "encerrada" : "desconhecido";
      }
      case "lever": {
        const slug = new URL(job.url).pathname.split("/").filter(Boolean)[0];
        const r = await get(`https://api.lever.co/v0/postings/${slug}/${ext}`);
        return r.ok ? "aberta" : r.status === 404 ? "encerrada" : "desconhecido";
      }
      case "smartrecruiters": {
        const slug = new URL(job.url).pathname.split("/").filter(Boolean)[0];
        const r = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${ext}`);
        return r.ok ? "aberta" : r.status === 404 ? "encerrada" : "desconhecido";
      }
      case "ashby": {
        const org = new URL(job.url).pathname.split("/").filter(Boolean)[0];
        const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${org}`);
        if (!r.ok) return "desconhecido";
        const d = (await r.json()) as { jobs: { id: string }[] };
        return d.jobs.some((x) => x.id === ext) ? "aberta" : "encerrada";
      }
      default:
        return "desconhecido";
    }
  } catch {
    return "desconhecido";
  }
}
