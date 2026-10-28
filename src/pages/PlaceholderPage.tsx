interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Placeholder for screens built in later stages (History: Stage 2, Stats: Stage 3). */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <h1 className="pt-2 text-2xl font-bold tracking-tight">{title}</h1>
      <div className="card flex flex-col items-center p-10 text-center">
        <div className="mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 opacity-80" />
        <p className="font-medium">Coming soon</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}
