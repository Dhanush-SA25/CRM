/**
 * Re-usable badge — wraps className-based badge utilities.
 */
export default function Badge({ children, className = "badge-gray" }) {
  return <span className={className}>{children}</span>;
}
