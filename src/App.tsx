import { useId, useState } from "react";
import { wordCounts } from "./words";

// PLACEHOLDER: the first page. Every new page (route) goes into PAGES in e2e/pages.ts, so the browser test checks it.
export function App() {
  const id = useId();
  const [text, setText] = useState("");
  const counts = wordCounts(text).slice(0, 5);
  return (
    <main className="wrap">
      <h1>Start</h1>
      <label htmlFor={id}>Text</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <table>
        <caption className="sr-only">Häufigste Wörter</caption>
        <thead>
          <tr>
            <th scope="col">Wort</th>
            <th scope="col">Anzahl</th>
          </tr>
        </thead>
        <tbody>
          {counts.map(([word, n]) => (
            <tr key={word}>
              <td data-label="Wort">{word}</td>
              <td data-label="Anzahl">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
