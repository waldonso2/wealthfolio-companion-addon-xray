// UI texts in German (the key) and English. The language follows Wealthfolio's: the sandbox sets <html lang>.

export type Lang = "de" | "en";

export function language(): Lang {
  const lang = (typeof document !== "undefined" && document.documentElement.lang) || "de";
  return lang.toLowerCase().startsWith("de") ? "de" : "en";
}

export const EN: Record<string, string> = {
  "X-Ray": "X-Ray",
  "Was in deinen ETFs steckt – über alle Konten, mit den Werten aus Wealthfolio.":
    "What your ETFs hold - across all accounts, with the values from Wealthfolio.",
  "Lädt …": "Loading …",
  "Neu laden": "Reload",
  "Noch keine Daten. Im Broker-Sync-Dienst auf der Seite „Dienste“ „X-Ray in Wealthfolio“ einschalten – nach dem nächsten Abruf stehen die Fondslisten hier.":
    "No data yet. In the broker sync service, switch on \"X-Ray in Wealthfolio\" on the page \"Dienste\" - after the next fetch the funds' lists are here.",
  "Die Daten stammen von einer neueren Version des Dienstes (Schema {schema}). Bitte das Addon aktualisieren.":
    "The data comes from a newer version of the service (schema {schema}). Please update the addon.",
  "Wealthfolio antwortet nicht: {error}": "Wealthfolio does not answer: {error}",
  "Keine Positionen in Wealthfolio.": "No positions in Wealthfolio.",
  "Stand der Fondslisten: {when}": "Funds' lists as of: {when}",
  "Letzter Abruf: {when}": "Last fetch: {when}",
  "Fehler beim letzten Abruf: {error}": "Error in the last fetch: {error}",
  "Der Dienst hat seit über 8 Tagen nichts geschrieben – läuft er noch?":
    "The service has written nothing for more than 8 days - is it still running?",
  "Werte vom {when} aus Wealthfolio": "Values of {when} from Wealthfolio",
  "Kennzahlen": "Key figures",
  "Depotwert ohne Bargeld": "Depot value without cash",
  "ETFs mit Liste": "ETFs with a list",
  "ETFs ohne Liste": "ETFs without a list",
  "Effektive Titelzahl": "Effective number of stocks",
  "Nicht zugeordnet": "Unassigned",
  "Gesamt: Aktien über alle Positionen": "Overall: stocks across all positions",
  "Zeigen": "Show",
  "Top {n}": "Top {n}",
  "alle": "all",
  "Aktie": "Stock",
  "Land": "Country",
  "Anteil": "Share",
  "weitere ETFs": "other ETFs",
  "direkt": "direct",
  "Summe": "Total",
  "Aktien über alle Positionen, größte zuerst": "Stocks across all positions, largest first",
  "Noch ohne Liste (zählen als eine Position): {names}": "Still without a list (count as one position): {names}",
  "Wie sich die ETFs überschneiden": "How the ETFs overlap",
  "Überschneidung je Paar von ETFs in Prozent": "Overlap of each pair of ETFs in percent",
  "ETFs ({n})": "ETFs ({n})",
  "Anbieter": "Issuer",
  "TER": "TER",
  "unbekannt": "unknown",
  "von Finanzfluss": "from Finanzfluss",
  "eigene": "own",
  "Wert": "Value",
  "Abdeckung": "Coverage",
  "Eigener Beitrag": "Own contribution",
  "Synthetischer ETF (Swap): die Liste ist sein Wertpapierkorb, nicht der Index.":
    "Synthetic ETF (swap): the list is its basket of securities, not the index.",
  "Die Liste wird gerade aktualisiert.": "The list is being updated right now.",
  "Größte Positionen von {name}": "Largest positions of {name}",
  "Gewicht": "Weight",
  "Dein Anteil": "Your share",
  "Alle {n} anzeigen": "Show all {n}",
  "Klumpenrisiken": "Cluster risks",
  "Keine Klumpenrisiken über den Grenzen.": "No cluster risks above the limits.",
  "Grenze {limit}": "Limit {limit}",
  "Bewusst so": "On purpose",
  "Bewusst so ({n})": "On purpose ({n})",
  "Wieder melden": "Report again",
  "Einzelaktie": "Single stock",
  "Fremdwährung": "Foreign currency",
  "Überschneidung": "Overlap",
  "Bargeld auf einem Konto": "Cash on one account",
  "Sektor": "Sector",
  "Einstellungen": "Settings",
  "Einzelaktie über (%)": "Single stock above (%)",
  "Land über (%)": "Country above (%)",
  "Sektor über (%)": "Sector above (%)",
  "Fremdwährung über (%)": "Foreign currency above (%)",
  "Überschneidung über (%)": "Overlap above (%)",
  "Effektive Titel unter": "Effective stocks below",
  "Bargeld je Konto über": "Cash per account above",
  "Speichern": "Save",
  "Zurück auf Standard": "Back to the defaults",
  "Gespeichert.": "Saved.",
  "Bitte eine Zahl von 0 bis 100 (Prozent) bzw. 0 bis 1.000.000.000 eintragen.":
    "Please enter a number from 0 to 100 (percent) or 0 to 1,000,000,000.",
  "Was wird berechnet?": "What is computed?",
  "Anteil am Depot: Wert der Position mal Gewicht der Aktie im Fonds, über alle Positionen addiert. Was die Gewichte eines Fonds offen lassen, steht als „nicht zugeordnet“ – nichts wird hochgerechnet. Überschneidung zweier ETFs: Summe des jeweils kleineren Gewichts jeder Aktie, die beide halten. Eigener Beitrag: der Teil eines ETFs, den keine andere Position mitbringt. Effektive Titelzahl: so vielen gleich gewichteten Aktien entspricht das Depot. Die Fondslisten legt der Broker-Sync-Dienst in Wealthfolio ab; dieses Addon geht nicht ins Netz.":
    "Share of the depot: the position's value times the stock's weight in the fund, added up over all positions. What a fund's weights leave open is \"unassigned\" - nothing is scaled up. Overlap of two ETFs: the sum of the smaller weight of every stock both hold. Own contribution: the part of an ETF no other position brings. Effective number of stocks: how many equally weighted stocks the depot is worth. The broker sync service stores the funds' lists in Wealthfolio; this addon makes no network requests.",
};

export function translate(lang: Lang, key: string, params: Record<string, string | number> = {}): string {
  const text = lang === "en" ? (EN[key] ?? key) : key;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function formatters(lang: Lang, currency: string) {
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct2 = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = (iso?: string | null) => {
    if (!iso) return "–";
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "–";
    const day = d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }); // YYYY-MM-DD
    return lang === "de" ? day.split("-").reverse().join(".") : day;
  };
  return { money: (v: number) => money.format(v), pct: (v: number) => pct.format(v), pct2: (v: number) => pct2.format(v), num: (v: number) => num.format(v), date };
}
