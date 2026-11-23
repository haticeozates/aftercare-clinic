"use client";

export default function ReportError({ reset }: { reset: () => void }) {
  return <section className="page-section">
    <h1>Raporlar ve Analitik</h1>
    <p role="alert">Rapor şu anda yüklenemedi.</p>
    <button className="ui-button ui-button--secondary" type="button" onClick={reset}>Tekrar dene</button>
  </section>;
}
