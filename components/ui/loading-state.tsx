export function LoadingState({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="loading-state panel stack" role="status" aria-busy="true" aria-live="polite">
      <p>{label}</p>
      <div className="loading-lines" aria-hidden="true"><span /><span /></div>
    </div>
  );
}
