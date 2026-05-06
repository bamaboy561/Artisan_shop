export default function PublicLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
        <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          Загрузка…
        </p>
      </div>
    </div>
  );
}
