import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Package, User, Lock } from 'lucide-react';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const login = useAuthStore((state: { login: any }) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login({ username: username.trim(), password });
      if (success) {
        navigate('/');
      } else {
        setError('Username atau password salah');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat login');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-4 relative">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-4 flex flex-col items-center text-center pb-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-primary/30">
            <Package className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Stock Opname</CardTitle>
            <CardDescription className="text-muted-foreground">
              Silakan masuk untuk melanjutkan
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-10 bg-background/50"
                    />
                </div>
                </div>
                
                <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="password"
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-10 bg-background/50"
                    />
                </div>
                </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-10 font-medium text-sm transition-all hover:shadow-md" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </div>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>

            <div className="mt-8 flex justify-center">
                <div className="px-4 py-2 bg-muted/50 rounded-full border border-border text-xs text-muted-foreground font-mono">
                    Default: admin / admin123
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="absolute bottom-6 text-center text-xs text-muted-foreground/60 w-full">
        <p>&copy; {new Date().getFullYear()} Stock Opname System. All rights reserved.</p>
      </div>
    </div>
  );
};
