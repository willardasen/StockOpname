import { Button } from '@/components/ui/button';
type Props = { page: number; size: number; total: number; setPage: (page: number) => void; error: string };
export function PageControls({ page, size, total, setPage, error }: Props) {
  if (error) return <p role="alert">{error}</p>;
  const last = Math.max(1, Math.ceil(total / size));
  if (last <= 1) return null;
  return <nav aria-label="Halaman hasil" className="flex items-center justify-end gap-2">
    <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
    <span>{page} / {last}</span>
    <Button variant="outline" disabled={page === last} onClick={() => setPage(page + 1)}>Berikutnya</Button>
  </nav>;
}
