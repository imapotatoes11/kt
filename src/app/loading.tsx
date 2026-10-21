export default function Loading() {
  return (
    <main
      className="mx-auto grid min-h-[100dvh] w-[min(100%,520px)] content-center gap-[18px] px-6 py-10"
      aria-busy="true"
      aria-label="Loading timetable"
    >
      <div className="font-mono text-base font-bold">…</div>
      <div className="skeleton h-4 w-[42%]" />
      <div className="skeleton h-[220px]" />
    </main>
  );
}
