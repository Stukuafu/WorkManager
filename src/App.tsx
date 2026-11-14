import { Balloon } from "./components/Balloon";
import { STATUSES, STATUS_LABELS } from "./domain/workflow";

const STATUS_TINT = {
  todo: "bg-tint-blue",
  in_progress: "bg-tint-yellow",
  in_review: "bg-tint-teal",
  done: "bg-tint-green",
} as const;

export default function App() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-t-4 border-brand-red bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Balloon size={28} />
          <h1 className="text-2xl">Work Manager</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-6 text-sm">
          Foundation milestone: data model and storage are in place. Projects, items and the board
          come next.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUSES.map((status) => (
            <section key={status} className="rounded-card bg-white p-4 shadow-sm">
              <div className={`mb-3 rounded-md px-3 py-1.5 text-sm font-bold text-ink ${STATUS_TINT[status]}`}>
                {STATUS_LABELS[status]}
              </div>
              <p className="text-sm text-brand-gray">No items yet</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
