import { db, sources, type SourceKind } from "@/db";

// Empresas com vagas no Brasil em board público, verificadas em 11/11/2026 (vagas BR / total).
// Novas empresas desta lista são adicionadas a todos os usuários; quem pausou continua pausado.
export const SEEDS: { kind: SourceKind; slug: string; name: string }[] = [
  { kind: "greenhouse", slug: "stone", name: "Stone" }, // 324
  { kind: "greenhouse", slug: "btgpactual", name: "BTG Pactual" }, // 230
  { kind: "greenhouse", slug: "c6bank", name: "C6 Bank" }, // 157
  { kind: "greenhouse", slug: "inter", name: "Banco Inter" }, // 118
  { kind: "greenhouse", slug: "agibank", name: "Agibank" }, // 112
  { kind: "lever", slug: "ciandt", name: "CI&T" }, // 94
  { kind: "greenhouse", slug: "xpinc", name: "XP Inc." }, // 92
  { kind: "greenhouse", slug: "quintoandar", name: "QuintoAndar" }, // 81
  { kind: "greenhouse", slug: "bees", name: "BEES (Ambev)" }, // 52
  { kind: "greenhouse", slug: "abinbev", name: "AB InBev / Ambev" }, // 45
  { kind: "ashby", slug: "nubank", name: "Nubank" }, // 41
  { kind: "greenhouse", slug: "gympass", name: "Wellhub (Gympass)" }, // 36
  { kind: "smartrecruiters", slug: "experian", name: "Serasa Experian" }, // 25
  { kind: "greenhouse", slug: "ebanx", name: "EBANX" }, // 22
  { kind: "greenhouse", slug: "vtex", name: "VTEX" }, // 17
  { kind: "lever", slug: "flashapp", name: "Flash" }, // 16
  { kind: "greenhouse", slug: "wildlifestudios", name: "Wildlife Studios" }, // 16
  { kind: "greenhouse", slug: "getnet", name: "Getnet" }, // 13
  { kind: "greenhouse", slug: "bancopan", name: "Banco Pan" }, // 13
  { kind: "lever", slug: "swile", name: "Swile" }, // 13
  { kind: "greenhouse", slug: "airbnb", name: "Airbnb" }, // 11
  { kind: "greenhouse", slug: "jusbrasil", name: "Jusbrasil" }, // 6
  { kind: "greenhouse", slug: "rdstation", name: "RD Station" }, // 4
  { kind: "greenhouse", slug: "thoughtworks", name: "Thoughtworks" }, // 2
  { kind: "lever", slug: "neon", name: "Neon" }, // 2
  { kind: "lever", slug: "kavak", name: "Kavak" }, // 1
  // Gupy ({slug}.gupy.io), verificadas em 11/11/2026 (vagas abertas)
  ...([
    ["assai", "Assaí Atacadista", 3614], ["rededor", "Rede D'Or", 2031], ["gpa", "GPA (Pão de Açúcar)", 1279],
    ["pagseguro", "PagBank / PagSeguro", 899], ["lojasrenner", "Lojas Renner", 861], ["sicredi", "Sicredi", 858],
    ["localiza", "Localiza", 853], ["hapvidandi", "Hapvida NotreDame", 716], ["petz", "Petz", 518],
    ["fortbras", "Fortbras", 316], ["ambev", "Ambev", 307], ["grupoboticario", "Grupo Boticário", 266],
    ["cogna", "Cogna", 224], ["stefanini", "Stefanini", 222], ["unidas", "Unidas", 209], ["jsl", "JSL", 181],
    ["aegea", "Aegea", 147], ["porto", "Porto", 146], ["renner", "Renner", 136], ["atento", "Atento", 135],
    ["spani", "Spani Atacadista", 127], ["vivara", "Vivara", 121], ["afya", "Afya", 117],
    ["votorantimcimentos", "Votorantim Cimentos", 112], ["tenda", "Construtora Tenda", 109], ["positivo", "Positivo", 90],
    ["weg", "WEG", 81], ["vivo", "Vivo", 77], ["dexco", "Dexco", 75], ["alpargatas", "Alpargatas", 61],
    ["suzano", "Suzano", 60], ["cea", "C&A", 59], ["eurofarma", "Eurofarma", 59], ["tecban", "TecBan", 58],
    ["jhsf", "JHSF", 53], ["tigre", "Tigre", 50], ["vibraenergia", "Vibra Energia", 48], ["fastshop", "Fast Shop", 41],
    ["yduqs", "Yduqs", 35], ["bauducco", "Bauducco", 33], ["bemol", "Bemol", 33], ["honda", "Honda", 32],
    ["compass", "Compass", 31], ["tupy", "Tupy", 28], ["ipiranga", "Ipiranga", 26], ["guararapes", "Guararapes", 25],
    ["cyrela", "Cyrela", 24], ["globo", "Globo", 22], ["simpar", "Simpar", 22], ["asaas", "Asaas", 20],
    ["totalexpress", "Total Express", 18], ["grupoultra", "Grupo Ultra", 17], ["aeris", "Aeris", 16],
    ["tegma", "Tegma", 16], ["uol", "UOL", 15], ["usiminas", "Usiminas", 13], ["algar", "Algar", 13],
    ["estadao", "Estadão", 13], ["alupar", "Alupar", 12], ["condor", "Condor", 12], ["vulcabras", "Vulcabras", 12],
    ["mondelez", "Mondelez", 11], ["brasilprev", "Brasilprev", 11], ["bmg", "Banco BMG", 10], ["creditas", "Creditas", 10],
    ["arcor", "Arcor", 10], ["ecorodovias", "EcoRodovias", 9], ["somos", "Somos Educação", 9], ["softplan", "Softplan", 9],
    ["marisol", "Marisol", 9], ["valid", "Valid", 8], ["prio", "PRIO", 7], ["zenvia", "Zenvia", 5],
    ["grupohinode", "Hinode", 4], ["randon", "Randon", 3], ["embracon", "Embracon", 2], ["zamp", "Zamp", 2],
  ] as const).map(([slug, name]) => ({ kind: "gupy" as const, slug, name })),
];

export async function ensureSeeds(userId: string) {
  await db
    .insert(sources)
    .values(SEEDS.map((s) => ({ ...s, userId })))
    .onConflictDoNothing();
}
