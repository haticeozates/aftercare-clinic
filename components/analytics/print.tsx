"use client";

export function PrintReport() {
  return <button className="ui-button ui-button--secondary" onClick={() => window.print()} type="button">Yazdır</button>;
}
