/** Country-pack ready fact model (NL first). */
export type CountryCode = "NL";

export type ScoreProfile = "consumer" | "commercial";

export type SourceStatus = "ok" | "missing" | "error" | "skipped";

export interface SourceMeta {
  id: string;
  label: string;
  status: SourceStatus;
  fetchedAt?: string;
  peildatum?: string;
  error?: string;
  latencyMs?: number;
  attribution?: string;
}

export interface ResolvedAddress {
  country: CountryCode;
  weergavenaam: string;
  straatnaam: string;
  huisnummer: string;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode: string;
  woonplaatsnaam: string;
  gemeentenaam: string;
  gemeentecode?: string;
  provincienaam?: string;
  buurtcode?: string;
  buurtnaam?: string;
  wijkcode?: string;
  wijknaam?: string;
  nummeraanduidingId: string;
  adresseerbaarObjectId?: string;
  pandId?: string;
  /** WGS84 */
  lat: number;
  lon: number;
  /** RD New (EPSG:28992) if available */
  rdX?: number;
  rdY?: number;
}

export interface BagFacts {
  bouwjaar?: number;
  oppervlakte?: number;
  gebruiksdoel?: string[];
  status?: string;
}

export interface EnergyFacts {
  labelklasse?: string;
  energieIndex?: number;
  registratiedatum?: string;
  gebouwtype?: string;
}

export interface WozPoint {
  peildatum: string;
  waarde: number;
}

export interface WozFacts {
  actueleWaarde?: number;
  peildatum?: string;
  historie: WozPoint[];
  trendPctPerJaar?: number;
}

export interface CbsFacts {
  inwoners?: number;
  huishoudens?: number;
  gemiddeldInkomen?: number;
  /** Gemiddelde WOZ woningwaarde in euro's */
  gemiddeldeWoz?: number;
  afstandSupermarktKm?: number;
  afstandHuisartsKm?: number;
  afstandStationKm?: number;
  afstandBasisschoolKm?: number;
  afstandKinderopvangKm?: number;
}

export interface CrimeFacts {
  misdrijvenTotaal?: number;
  misdrijvenPer1000?: number;
  landelijkGemiddeldePer1000?: number;
  pctVsLandelijk?: number;
  peiljaar?: string;
  inbraakWoning?: number;
  fietsendiefstal?: number;
  mishandeling?: number;
}

export interface MarketFacts {
  /** YoY-ontwikkeling prijsindex bestaande koopwoningen (%) */
  prijsindexYoY?: number;
  gemiddeldeVerkoopprijs?: number;
  verkochteWoningen?: number;
  verkochtYoY?: number;
  peilperiode?: string;
  regio?: string;
}

export interface SurroundingsFacts {
  afstandOvHalteM?: number;
  ovHalteNaam?: string;
  ovHalteType?: string;
  parkenBinnen400m?: number;
  afstandParkM?: number;
  beschermdGezicht?: boolean;
  beschermdGezichtNaam?: string;
}

export interface Bekendmaking {
  titel: string;
  datum?: string;
  type?: string;
  url?: string;
}

export interface BekendmakingenFacts {
  count12m: number;
  items: Bekendmaking[];
  samenvatting?: string;
}

export interface EnvironmentFacts {
  no2?: number;
  pm25?: number;
  /** Lden alle bronnen gecombineerd (dB) */
  geluidLden?: number;
  geluidWegLden?: number;
  geluidSpoorLden?: number;
  geluidVliegLden?: number;
}

export interface PerceelFacts {
  /** Bijv. "Amsterdam F 6685" */
  kadastraleAanduiding: string;
  grootteM2?: number;
}

export interface MonumentFacts {
  /** Indicatie o.b.v. rijksmonumentpunten binnen ~15 m van het adres */
  isRijksmonument: boolean;
  rijksmonumentNummer?: number;
  categorie?: string;
  monumentUrl?: string;
  /** Monumentdichtheid rond het adres (binnen ~75 m), bv. beschermd stadsgezicht-indicatie */
  aantalBinnen75m: number;
}

export interface ClimateFacts {
  overstromingsdiepteM?: number | null;
  funderingsrisico?: string | null;
  bodemdalingMmJaar?: number | null;
  /** Waterdiepte bij hoosbui 70 mm / 2 uur (m); 0 = geen wateroverlast */
  wateroverlastHoosbuiM?: number | null;
  /** Stedelijk hitte-eiland (°C extra t.o.v. landelijk) */
  hitteeilandC?: number | null;
  /** Fysiologische equivalenttemperatuur buurt (°C, PET) */
  gevoelstemperatuurC?: number | null;
  /** Indicatie aardbevingsgebied (gemeenten Groningen-gasveld) */
  aardbevingRisico?: boolean;
}

export interface SchoolNearby {
  naam: string;
  afstandM: number;
  /** bo = basisonderwijs, vo = voortgezet onderwijs */
  type?: "bo" | "vo";
  denominatie?: string;
}

export interface SchoolsFacts {
  binnen1km: number;
  basisscholenBinnen1km?: number;
  middelbareScholenBinnen1km?: number;
  scholen: SchoolNearby[];
}

export interface PropertyFacts {
  address: ResolvedAddress;
  bag?: BagFacts;
  energy?: EnergyFacts;
  woz?: WozFacts;
  cbs?: CbsFacts;
  crime?: CrimeFacts;
  bekendmakingen?: BekendmakingenFacts;
  environment?: EnvironmentFacts;
  climate?: ClimateFacts;
  schools?: SchoolsFacts;
  perceel?: PerceelFacts;
  monument?: MonumentFacts;
  market?: MarketFacts;
  surroundings?: SurroundingsFacts;
  sources: SourceMeta[];
}

export type PartialScoreKey =
  | "woning"
  | "waarde"
  | "veiligheid"
  | "milieu"
  | "klimaat"
  | "voorzieningen"
  | "buurt";

export interface PartialScore {
  key: PartialScoreKey;
  label: string;
  score: number | null;
  /** Ongekalibreerde score (alleen gezet als kalibratie is toegepast) */
  raw?: number;
  weight: number;
  benchmark?: number;
  details: string[];
}

export interface Bullet {
  text: string;
  kind: "positive" | "negative" | "neutral";
}

export type RiskLevel = "green" | "amber" | "red" | "unknown";

export interface RiskItem {
  id: string;
  label: string;
  level: RiskLevel;
  detail: string;
  sourceId?: string;
}

export interface Improvement {
  id: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
}

export interface ScoreResult {
  profile: ScoreProfile;
  total: number | null;
  partials: PartialScore[];
  positives: Bullet[];
  negatives: Bullet[];
  risks?: RiskItem[];
  summary?: string;
  buurtVergelijking?: string;
  improvements?: Improvement[];
  disclaimer: string;
}

export interface ScoreHistoryPoint {
  date: string;
  total: number | null;
}

export interface FullReport {
  facts: PropertyFacts;
  score: ScoreResult;
  generatedAt: string;
  /** Scoreverloop over eerdere rapportages (max 30 punten) */
  history?: ScoreHistoryPoint[];
}

export interface SuggestItem {
  id: string;
  weergavenaam: string;
  type: string;
  score?: number;
}
