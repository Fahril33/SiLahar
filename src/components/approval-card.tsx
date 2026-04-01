export function ApprovalCard({
  title,
  name,
  meta,
}: {
  title: string;
  name: string;
  meta: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 p-4 text-center">
      <p className="text-sm font-semibold uppercase">{title}</p>
      <div className="h-16" />
      <p className="font-bold uppercase">{name}</p>
      <p className="mt-1 text-sm text-ink/65">{meta}</p>
    </div>
  );
}
