import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetStock } from '@/repositories';

export function ResetStockAction({ userId }: { userId: number | undefined }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [error, setError] = useState('');
  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  const openDialog = () => {
    setPassword('');
    setError('');
    dialog.current?.showModal();
    passwordInput.current?.focus();
  };

  const dismissDialog = () => {
    if (submitting.current) return;
    if (isSuccess) {
      window.location.reload();
      return;
    }

    setPassword('');
    setError('');
    dialog.current?.close();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (userId === undefined || !password || submitting.current || isSuccess) return;

    submitting.current = true;
    setStatus('loading');
    setError('');
    setPassword('');

    try {
      if (await resetStock(userId, password)) {
        setStatus('success');
        return;
      }
      setError('Password salah.');
    } catch (failure) {
      setError(`Reset stok gagal. ${failure instanceof Error ? failure.message : String(failure)}`);
    } finally {
      submitting.current = false;
    }

    setStatus('idle');
    requestAnimationFrame(() => {
      if (dialog.current?.open) passwordInput.current?.focus();
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start text-orange-400/80 hover:text-orange-300 hover:bg-orange-500/10"
        onClick={openDialog}
        disabled={userId === undefined}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Reset Stok
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="reset-stock-title"
        aria-describedby="reset-stock-description"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))] shadow-xl backdrop:bg-black/50"
        onCancel={(event) => {
          event.preventDefault();
          dismissDialog();
        }}
      >
        <h2 id="reset-stock-title" className="text-lg font-semibold">Reset Stok</h2>
        {isSuccess ? (
          <div className="mt-2 space-y-5">
            <p id="reset-stock-description" role="status">Stok berhasil direset.</p>
            <div className="flex justify-end">
              <Button autoFocus onClick={dismissDialog}>Selesai</Button>
            </div>
          </div>
        ) : (
          <>
            <p id="reset-stock-description" className="mt-2 text-sm text-muted-foreground">
              Stok semua produk akan menjadi 0. Riwayat transaksi dan stok opname akan dihapus.
              Data produk, pengaturan brand, dan akun tetap tersimpan.
            </p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-stock-password">Password akun yang sedang login</Label>
                <Input
                  ref={passwordInput}
                  id="reset-stock-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={dismissDialog} disabled={isLoading}>
                  Batal
                </Button>
                <Button type="submit" variant="destructive" disabled={isLoading || !password}>
                  {isLoading ? (
                    <span role="status" className="flex items-center gap-2">
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      Memproses reset stok…
                    </span>
                  ) : 'Reset Stok'}
                </Button>
              </div>
            </form>
          </>
        )}
      </dialog>
    </>
  );
}
