// Sites de recrutamento cujo formulário o robô sabe preencher.
export const AUTO_APPLY_HOSTS = [/(^|\.)greenhouse\.io$/, /(^|\.)lever\.co$/, /(^|\.)ashbyhq\.com$/];

// Sites que exigem login próprio e proíbem automação: só candidatura manual.
const MANUAL_ONLY = [/linkedin\.com$/, /indeed\./, /glassdoor\./, /catho\.com\.br$/, /infojobs\.com\.br$/, /vagas\.com\.br$/];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function canAutoApply(url: string): boolean {
  const h = hostOf(url);
  return AUTO_APPLY_HOSTS.some((r) => r.test(h));
}

/** Escolhe o melhor link de candidatura: formulário que o robô preenche > site da empresa > portais. */
export function pickApplyUrl(links: string[]): string | undefined {
  const valid = links.filter((l) => hostOf(l));
  return (
    valid.find(canAutoApply) ??
    valid.find((l) => !MANUAL_ONLY.some((r) => r.test(hostOf(l)))) ??
    valid[0]
  );
}
