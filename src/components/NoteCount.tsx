/** Small "2 notes" indicator; renders nothing when there are none. */
export function NoteCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  const label = `${count} ${count === 1 ? "note" : "notes"}`;
  return (
    <span className="inline-flex items-center gap-1 text-xs" title={label}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current">
        <path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
