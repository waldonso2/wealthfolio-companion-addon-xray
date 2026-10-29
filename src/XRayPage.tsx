import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { readStore, type Storage, type Store } from "./contract";
import { readDepot, type Api, type Depot } from "./depot";
import { formatters, language, translate } from "./i18n";
import { TOPS, top as topRows } from "./matrix";
import { compute, heat, type Model } from "./model";
import { defaults, load, parseLimit, save, type Settings } from "./settings";
import type { Finding, Limits } from "./xray";

type Data = { store: Store; depot: Depot; settings: Settings; at: number } | { error: string } | null;
const STALE_DAYS = 8;
const FUND_TOP = 10;

export function XRayPage({ storage, api }: { storage: Storage; api: Api }) {
  const lang = language();
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);
  const [data, setData] = useState<Data>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([readStore(storage), readDepot(api), load(storage)])
      .then(([store, depot, settings]) => live && setData({ store, depot, settings, at: Date.now() }))
      .catch((e: unknown) => live && setData({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [storage, api, tick]);

  const reload = () => {
    setData(null);
    setTick((n) => n + 1);
  };

  return (
    <main className="xr">
      <div className="xr-head">
        <h1>{t("X-Ray")}</h1>
        <button type="button" className="xr-button secondary" onClick={reload} disabled={data === null}>
          {t("Neu laden")}
        </button>
      </div>
      <p className="xr-muted">{t("Was in deinen ETFs steckt – über alle Konten, mit den Werten aus Wealthfolio.")}</p>
      <Body data={data} t={t} lang={lang} storage={storage} setData={setData} />
    </main>
  );
}

type T = (key: string, params?: Record<string, string | number>) => string;

function Body({ data, t, lang, storage, setData }: { data: Data; t: T; lang: "de" | "en"; storage: Storage; setData: (d: Data) => void }) {
  if (data === null) return <p role="status">{t("Lädt …")}</p>;
  if ("error" in data) return <p role="alert" className="xr-error">{t("Wealthfolio antwortet nicht: {error}", { error: data.error })}</p>;
  const { store, depot, settings, at } = data;
  if (store.kind === "none")
    return <p className="xr-card">{t("Noch keine Daten. Im Broker-Sync-Dienst auf der Seite „Dienste“ „X-Ray in Wealthfolio“ einschalten – nach dem nächsten Abruf stehen die Fondslisten hier.")}</p>;
  if (store.kind === "newer")
    return <p role="alert" className="xr-card">{t("Die Daten stammen von einer neueren Version des Dienstes (Schema {schema}). Bitte das Addon aktualisieren.", { schema: store.schema })}</p>;
  if (!depot.positions.length) return <p className="xr-card">{t("Keine Positionen in Wealthfolio.")}</p>;
  return (
    <Report
      store={store}
      depot={depot}
      settings={settings}
      at={at}
      t={t}
      lang={lang}
      onSettings={async (s) => {
        await save(storage, s);
        setData({ store, depot, settings: s, at });
      }}
    />
  );
}

function Report({ store, depot, settings, at, t, lang, onSettings }: {
  store: Extract<Store, { kind: "ok" }>; depot: Depot; settings: Settings; at: number; t: T; lang: "de" | "en";
  onSettings: (s: Settings) => Promise<void>;
}) {
  const f = useMemo(() => formatters(lang, depot.base), [lang, depot.base]);
  const model = useMemo(() => compute(store, depot, settings), [store, depot, settings]);
  const index = store.index;
  const stale = index.written_at && at - new Date(index.written_at).getTime() > STALE_DAYS * 86400e3;
  return (
    <>
      <p className="xr-muted">
        {t("Stand der Fondslisten: {when}", { when: f.date(index.written_at) })} ·{" "}
        {t("Letzter Abruf: {when}", { when: f.date(index.last_pass?.at) })} ·{" "}
        {t("Werte vom {when} aus Wealthfolio", { when: f.date(depot.asOf) })}
      </p>
      {index.last_pass?.error && <p role="alert" className="xr-error">{t("Fehler beim letzten Abruf: {error}", { error: index.last_pass.error })}</p>}
      {stale && <p role="alert" className="xr-warn">{t("Der Dienst hat seit über 8 Tagen nichts geschrieben – läuft er noch?")}</p>}
      <Figures model={model} t={t} f={f} />
      <Matrix model={model} t={t} f={f} />
      <Overlap model={model} t={t} f={f} />
      <Funds model={model} t={t} f={f} />
      <Risks model={model} settings={settings} t={t} f={f} onSettings={onSettings} />
      <LimitsForm settings={settings} t={t} onSettings={onSettings} />
      <details className="xr-card">
        <summary><h2>{t("Was wird berechnet?")}</h2></summary>
        <p>{t("Anteil am Depot: Wert der Position mal Gewicht der Aktie im Fonds, über alle Positionen addiert. Was die Gewichte eines Fonds offen lassen, steht als „nicht zugeordnet“ – nichts wird hochgerechnet. Überschneidung zweier ETFs: Summe des jeweils kleineren Gewichts jeder Aktie, die beide halten. Eigener Beitrag: der Teil eines ETFs, den keine andere Position mitbringt. Effektive Titelzahl: so vielen gleich gewichteten Aktien entspricht das Depot. Die Fondslisten legt der Broker-Sync-Dienst in Wealthfolio ab; dieses Addon geht nicht ins Netz.")}</p>
      </details>
    </>
  );
}

type F = ReturnType<typeof formatters>;

function Figures({ model, t, f }: { model: Model; t: T; f: F }) {
  const items: [string, string][] = [
    [t("Depotwert ohne Bargeld"), f.money(model.total)],
    [t("ETFs mit Liste"), String(model.funds.length)],
    [t("ETFs ohne Liste"), String(model.pending.length + model.updating.length)],
    [t("Effektive Titelzahl"), f.num(model.effective)],
    [t("Nicht zugeordnet"), f.pct(model.unassigned)],
  ];
  return (
    <section className="xr-card" aria-labelledby="xr-figures">
      <h2 id="xr-figures">{t("Kennzahlen")}</h2>
      <dl className="xr-figures">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Matrix({ model, t, f }: { model: Model; t: T; f: F }) {
  const [choice, setChoice] = useState<string>(TOPS[0]);
  const id = useId();
  const rows = topRows(model.matrix, choice);
  const waiting = [...model.pending.map((p) => p.name), ...model.updating.map((u) => u.name)];
  return (
    <details className="xr-card">
      <summary><h2>{t("Gesamt: Aktien über alle Positionen")}</h2></summary>
      <div className="xr-toolbar">
        <label htmlFor={id}>{t("Zeigen")}</label>
        <select id={id} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {TOPS.map((v) => (
            <option key={v} value={v}>{v === "all" ? t("alle") : t("Top {n}", { n: v })}</option>
          ))}
        </select>
      </div>
      {waiting.length > 0 && <p className="xr-muted">{t("Noch ohne Liste (zählen als eine Position): {names}", { names: waiting.join(", ") })}</p>}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a region that scrolls sideways must be reachable by keyboard (WCAG 2.1.1, axe scrollable-region-focusable) */}
      <div className="xr-scroll" role="region" aria-label={t("Aktien über alle Positionen, größte zuerst")} tabIndex={0}>
        <table className="xr-matrix">
          <caption className="sr-only">{t("Aktien über alle Positionen, größte zuerst")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Aktie")}</th>
              <th scope="col" className="xr-num">{t("Anteil")}</th>
              {model.columns.map((h) => <th scope="col" className="xr-num" key={h.id}>{h.name}</th>)}
              {model.moreFunds && <th scope="col" className="xr-num">{t("weitere ETFs")}</th>}
              <th scope="col" className="xr-num">{t("direkt")}</th>
              <th scope="col" className="xr-num">{t("Summe")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row.key}>
                <td className="xr-name" data-label={t("Aktie")}>{r.row.name}{r.row.country && <span className="xr-muted"> · {r.row.country}</span>}</td>
                <td className="xr-num" data-label={t("Anteil")}>{f.pct2(r.row.share)}</td>
                {model.columns.map((h, i) => <Amount key={h.id} label={h.name} value={r.columns[i]} f={f} />)}
                {model.moreFunds && <Amount label={t("weitere ETFs")} value={r.others} f={f} />}
                <Amount label={t("direkt")} value={r.direct} f={f} />
                <td className="xr-num xr-total" data-label={t("Summe")}>{f.money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** An amount of the matrix; an empty one is "–" on wide screens and left out on phones. */
function Amount({ label, value, f }: { label: string; value: number | null | undefined; f: F }) {
  return <td className={value ? "xr-num" : "xr-num xr-empty"} data-label={label}>{value ? f.money(value) : "–"}</td>;
}

function Overlap({ model, t, f }: { model: Model; t: T; f: F }) {
  const { funds, cells } = model.overlap;
  if (funds.length < 2) return null;
  return (
    <details className="xr-card">
      <summary><h2>{t("Wie sich die ETFs überschneiden")}</h2></summary>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a region that scrolls sideways must be reachable by keyboard (WCAG 2.1.1, axe scrollable-region-focusable) */}
      <div className="xr-scroll" role="region" aria-label={t("Überschneidung je Paar von ETFs in Prozent")} tabIndex={0}>
        <table className="xr-heat">
          <caption className="sr-only">{t("Überschneidung je Paar von ETFs in Prozent")}</caption>
          <thead>
            <tr>
              <td />
              {funds.map((h, i) => (
                <th scope="col" key={h.id} title={h.name}>
                  <span aria-hidden="true">{i + 1}</span>
                  <span className="sr-only">{h.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map((a, i) => (
              <tr key={a.id}>
                <th scope="row"><span className="xr-idx" aria-hidden="true">{i + 1}</span>{a.name}</th>
                {funds.map((b, j) => (
                  <td key={b.id} data-label={b.name} className={i === j ? "heat-self" : heat(cells[i][j])}>
                    {i === j ? "–" : f.pct(cells[i][j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function terText(entry: Model["funds"][number]["entry"], t: T, f: F): string {
  if (!entry.ter) return t("unbekannt");
  const source = entry.ter_source === "finanzfluss" ? ` (${t("von Finanzfluss")})` : entry.ter_source === "manual" ? ` (${t("eigene")})` : "";
  return f.pct2(Number(entry.ter)) + source;
}

function Funds({ model, t, f }: { model: Model; t: T; f: F }) {
  return (
    <details className="xr-card">
      <summary><h2>{t("ETFs ({n})", { n: model.funds.length + model.pending.length + model.updating.length })}</h2></summary>
      {model.funds.map((card) => <FundCard key={card.holding.id} card={card} t={t} f={f} />)}
      {model.updating.map((u) => (
        <section key={u.id} className="xr-fund">
          <h3>{u.name}</h3>
          <p className="xr-muted">{t("Die Liste wird gerade aktualisiert.")}</p>
        </section>
      ))}
      {model.pending.map((p) => (
        <section key={p.asset_id} className="xr-fund">
          <h3>{p.name}</h3>
          <p role="alert" className="xr-error">{p.reason}</p>
        </section>
      ))}
    </details>
  );
}

function FundCard({ card, t, f }: { card: Model["funds"][number]; t: T; f: F }) {
  const [all, setAll] = useState(false);
  const { holding: h, entry } = card;
  const lines = all ? h.constituents : h.constituents.slice(0, FUND_TOP);
  return (
    <details className="xr-fund">
      <summary><h3>{h.name}</h3> <span className="xr-muted">{entry.isin} · {t("TER")} {terText(entry, t, f)}</span></summary>
      <dl className="xr-figures">
        <div><dt>{t("Anbieter")}</dt><dd>{entry.issuer || "–"}</dd></div>
        <div><dt>{t("Wert")}</dt><dd>{f.money(h.value)}</dd></div>
        <div><dt>{t("Abdeckung")}</dt><dd>{f.pct(Number(entry.coverage))}</dd></div>
        <div><dt>{t("Eigener Beitrag")}</dt><dd>{f.pct(card.ownShare)}</dd></div>
      </dl>
      {entry.note === "swap" && <p className="xr-muted">{t("Synthetischer ETF (Swap): die Liste ist sein Wertpapierkorb, nicht der Index.")}</p>}
      <table>
        <caption className="sr-only">{t("Größte Positionen von {name}", { name: h.name })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Aktie")}</th>
            <th scope="col" className="xr-num">{t("Gewicht")}</th>
            <th scope="col" className="xr-num">{t("Dein Anteil")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((c, i) => (
            <tr key={`${c.key}-${i}`}>
              <td>{c.name}</td>
              <td className="xr-num">{f.pct2(c.weight)}</td>
              <td className="xr-num">{f.money(h.value * c.weight)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!all && h.constituents.length > FUND_TOP && (
        <button type="button" className="xr-button secondary" onClick={() => setAll(true)}>
          {t("Alle {n} anzeigen", { n: h.constituents.length })}
        </button>
      )}
    </details>
  );
}

const KINDS: Record<string, string> = {
  stock: "Einzelaktie", country: "Land", sector: "Sektor", currency: "Fremdwährung", overlap: "Überschneidung",
  effective: "Effektive Titelzahl", cash: "Bargeld auf einem Konto",
};

function value(finding: Finding, f: F, v: number): string {
  if (finding.kind === "effective") return f.num(v);
  if (finding.kind === "cash") return f.money(v);
  return f.pct(v);
}

function Risks({ model, settings, t, f, onSettings }: { model: Model; settings: Settings; t: T; f: F; onSettings: (s: Settings) => Promise<void> }) {
  const set = (key: string, on: boolean) =>
    onSettings({ ...settings, accepted: on ? [...settings.accepted, key] : settings.accepted.filter((k) => k !== key) });
  const row = (x: Finding, accepted: boolean) => (
    <li key={x.key}>
      <span>
        <strong>{t(KINDS[x.kind] ?? x.kind)}</strong>{x.name && ` ${x.name}`}: {value(x, f, x.value)}{" "}
        <span className="xr-muted">({t("Grenze {limit}", { limit: value(x, f, x.limit) })})</span>
      </span>
      <button type="button" className="xr-button secondary" onClick={() => set(x.key, !accepted)}>
        {accepted ? t("Wieder melden") : t("Bewusst so")}
      </button>
    </li>
  );
  return (
    <details className="xr-card">
      <summary><h2>{t("Klumpenrisiken")} ({model.findings.length})</h2></summary>
      {model.findings.length ? <ul className="xr-list">{model.findings.map((x) => row(x, false))}</ul> : <p>{t("Keine Klumpenrisiken über den Grenzen.")}</p>}
      {model.accepted.length > 0 && (
        <details>
          <summary>{t("Bewusst so ({n})", { n: model.accepted.length })}</summary>
          <ul className="xr-list">{model.accepted.map((x) => row(x, true))}</ul>
        </details>
      )}
    </details>
  );
}

const FIELDS: [keyof Limits, string][] = [
  ["stock", "Einzelaktie über (%)"], ["country", "Land über (%)"], ["sector", "Sektor über (%)"],
  ["currency", "Fremdwährung über (%)"], ["overlap", "Überschneidung über (%)"], ["effective", "Effektive Titel unter"],
  ["cash", "Bargeld je Konto über"],
];

function shown(key: keyof Limits, v: number): string {
  return key === "effective" || key === "cash" ? String(v) : String(Math.round(v * 10000) / 100);
}

function LimitsForm({ settings, t, onSettings }: { settings: Settings; t: T; onSettings: (s: Settings) => Promise<void> }) {
  const base = useId();
  const [texts, setTexts] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, shown(k, settings.limits[k])])));
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limits = { ...settings.limits };
    for (const [k] of FIELDS) {
      const v = parseLimit(k, texts[k]);
      if (v === null) return setMessage({ text: t("Bitte eine Zahl von 0 bis 100 (Prozent) bzw. 0 bis 1.000.000.000 eintragen."), ok: false });
      limits[k] = v;
    }
    await onSettings({ ...settings, limits });
    setMessage({ text: t("Gespeichert."), ok: true });
  };
  const reset = async () => {
    const d = defaults();
    setTexts(Object.fromEntries(FIELDS.map(([k]) => [k, shown(k, d.limits[k])])));
    await onSettings({ ...settings, limits: d.limits });
    setMessage({ text: t("Gespeichert."), ok: true });
  };
  return (
    <details className="xr-card">
      <summary><h2>{t("Einstellungen")}</h2></summary>
      <form onSubmit={submit} noValidate>
        <div className="xr-fields">
          {FIELDS.map(([k, label]) => (
            <div key={k}>
              <label htmlFor={`${base}-${k}`}>{t(label)}</label>
              <input id={`${base}-${k}`} inputMode="decimal" value={texts[k]} onChange={(e) => setTexts({ ...texts, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="xr-actions">
          <button type="submit" className="xr-button">{t("Speichern")}</button>
          <button type="button" className="xr-button secondary" onClick={reset}>{t("Zurück auf Standard")}</button>
        </div>
        {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "xr-ok" : "xr-error"}>{message.text}</p>}
      </form>
    </details>
  );
}
