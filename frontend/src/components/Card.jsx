export default function Card({ children, className = '' }) {
  return <section className={`lynx-card ${className}`}>{children}</section>;
}

