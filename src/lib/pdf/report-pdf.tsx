import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { FullReport, RiskLevel } from "@/lib/types";

const ACCENT = "#0f4c5c";
const INK = "#1c2b33";
const MUTED = "#5c6f78";
const BORDER = "#dde5e8";

const RISK_COLORS: Record<RiskLevel, string> = {
  green: "#2e7d32",
  amber: "#b26a00",
  red: "#c62828",
  unknown: "#78909c",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  brand: { fontSize: 16, color: ACCENT, marginBottom: 2 },
  title: { fontSize: 14, marginBottom: 2 },
  muted: { color: MUTED },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  scoreBox: {
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  scoreNumber: { fontSize: 26, color: ACCENT },
  section: { marginBottom: 14 },
  h2: { fontSize: 12, marginBottom: 6, color: ACCENT },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  cellLabel: { width: "34%" },
  cellValue: { width: "66%" },
  barTrack: {
    height: 6,
    backgroundColor: "#eef2f4",
    borderRadius: 3,
    width: "100%",
    marginTop: 2,
  },
  bullet: { flexDirection: "row", marginBottom: 2 },
  disclaimer: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 8,
    color: MUTED,
  },
});

export function ReportPdf({ report }: { report: FullReport }) {
  const { facts, score } = report;
  const a = facts.address;

  const factRows: Array<[string, string]> = [
    ["Adres", a.weergavenaam],
    ["Bouwjaar", facts.bag?.bouwjaar ? String(facts.bag.bouwjaar) : "—"],
    ["Oppervlakte", facts.bag?.oppervlakte ? `${facts.bag.oppervlakte} m²` : "—"],
    ["Energielabel", facts.energy?.labelklasse ?? "—"],
    [
      "Perceel",
      facts.perceel
        ? `${facts.perceel.kadastraleAanduiding}${facts.perceel.grootteM2 ? ` — ${facts.perceel.grootteM2.toLocaleString("nl-NL")} m²` : ""}`
        : "—",
    ],
    [
      "Monumentstatus",
      facts.monument
        ? facts.monument.isRijksmonument
          ? `Rijksmonument${facts.monument.rijksmonumentNummer ? ` nr. ${facts.monument.rijksmonumentNummer}` : ""}`
          : "Geen rijksmonument (indicatie)"
        : "—",
    ],
    [
      "Beschermd gezicht",
      facts.surroundings?.beschermdGezicht
        ? facts.surroundings.beschermdGezichtNaam ?? "ja"
        : "nee / onbekend",
    ],
    [
      "Markt",
      facts.market?.prijsindexYoY != null
        ? `Prijsindex ${facts.market.regio ?? ""} ${facts.market.prijsindexYoY}% YoY`
        : "—",
    ],
    [
      "WOZ-waarde",
      facts.woz?.actueleWaarde
        ? `€ ${facts.woz.actueleWaarde.toLocaleString("nl-NL")} (${facts.woz.peildatum ?? ""})`
        : facts.cbs?.gemiddeldeWoz
          ? `€ ${facts.cbs.gemiddeldeWoz.toLocaleString("nl-NL")} (buurtgemiddelde CBS)`
          : "—",
    ],
    [
      "WOZ-trend",
      facts.woz?.trendPctPerJaar != null ? `${facts.woz.trendPctPerJaar}% per jaar` : "—",
    ],
    ["Buurt", a.buurtnaam ? `${a.buurtnaam} (${a.gemeentenaam})` : a.gemeentenaam],
  ];

  return (
    <Document
      title={`Woonscore rapport — ${a.weergavenaam}`}
      author="Woonscore"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Woonscore</Text>
            <Text style={styles.title}>
              {score.profile === "commercial" ? "Due diligence rapport" : "Woonrapport"}
            </Text>
            <Text style={styles.muted}>{a.weergavenaam}</Text>
            <Text style={styles.muted}>
              Gegenereerd: {report.generatedAt.slice(0, 16).replace("T", " ")}
            </Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreNumber}>{score.total ?? "—"}</Text>
            <Text style={styles.muted}>/ 100</Text>
          </View>
        </View>

        {score.summary ? (
          <View style={styles.section}>
            <Text>{score.summary}</Text>
          </View>
        ) : null}

        {score.memo ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Beslismemo</Text>
            <Text
              style={{
                color:
                  score.memo.oordeel === "rood"
                    ? RISK_COLORS.red
                    : score.memo.oordeel === "oranje"
                      ? RISK_COLORS.amber
                      : RISK_COLORS.green,
                marginBottom: 4,
              }}
            >
              {score.memo.oordeelLabel}
            </Text>
            {score.memo.kernpunten.map((k) => (
              <View key={k} style={styles.bullet}>
                <Text>• </Text>
                <Text>{k}</Text>
              </View>
            ))}
            {score.memo.kosten.map((k) => (
              <View key={k.post} style={styles.bullet}>
                <Text style={styles.muted}>
                  {k.post}: {k.bandbreedte}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {score.memo?.vragen.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Vragen voor bezichtiging</Text>
            {score.memo.vragen.map((v, i) => (
              <View key={v} style={styles.bullet}>
                <Text>{i + 1}. </Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {score.memo?.documenten.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Documenten om op te vragen</Text>
            {score.memo.documenten.map((d) => (
              <View key={d} style={styles.bullet}>
                <Text>☐ </Text>
                <Text>{d}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.h2}>Kerngegevens</Text>
          {factRows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.cellLabel, styles.muted]}>{label}</Text>
              <Text style={styles.cellValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Deelscores</Text>
          {score.partials.map((p) => (
            <View key={p.key} style={styles.row}>
              <Text style={[styles.cellLabel, styles.muted]}>
                {p.label} ({Math.round(p.weight * 100)}%)
              </Text>
              <View style={styles.cellValue}>
                <Text>
                  {p.score ?? "geen data"}
                  {p.details.length ? `  —  ${p.details.join("; ")}` : ""}
                </Text>
                {p.score != null ? (
                  <View style={styles.barTrack}>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        width: `${p.score}%`,
                        backgroundColor: ACCENT,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {score.risks?.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Risico-checklist</Text>
            {score.risks.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={[styles.cellLabel, styles.muted]}>{r.label}</Text>
                <Text style={styles.cellValue}>
                  <Text style={{ color: RISK_COLORS[r.level] }}>
                    {r.level === "unknown" ? "onbekend" : r.level}
                  </Text>
                  {"   "}
                  {r.detail}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {score.positives.length || score.negatives.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Plus- en minpunten</Text>
            {score.positives.map((b) => (
              <View key={b.text} style={styles.bullet}>
                <Text style={{ color: RISK_COLORS.green }}>+ </Text>
                <Text>{b.text}</Text>
              </View>
            ))}
            {score.negatives.map((b) => (
              <View key={b.text} style={styles.bullet}>
                <Text style={{ color: RISK_COLORS.red }}>− </Text>
                <Text>{b.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.h2}>Bronnen</Text>
          {facts.sources.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={[styles.cellLabel, styles.muted]}>{s.label}</Text>
              <Text style={styles.cellValue}>
                {s.status}
                {s.attribution ? ` — ${s.attribution}` : ""}
                {s.fetchedAt ? ` (${s.fetchedAt.slice(0, 10)})` : ""}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>{score.disclaimer}</Text>
      </Page>
    </Document>
  );
}
