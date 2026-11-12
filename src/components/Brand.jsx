export default function Brand({ compact = false }) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`}>
      <span className="brand__name">Transcend Group of Institutions</span>
    </div>
  );
}
