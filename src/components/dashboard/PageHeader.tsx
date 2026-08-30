export function PageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {kicker && (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2">
          {kicker}
        </p>
      )}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">{title}</h1>
          {description && <p className="text-neutral-600 dark:text-neutral-400 mt-2 max-w-2xl">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}