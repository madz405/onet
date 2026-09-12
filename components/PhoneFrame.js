export default function PhoneFrame({ children, className = "" }) {
  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden rounded-[1.75rem] border-[6px] border-ink-800 bg-black shadow-glow ${className}`}
    >
      <span className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink-800" />
      {children}
    </div>
  );
}
