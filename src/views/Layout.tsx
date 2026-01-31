import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { Button } from '../components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { 
  Package, 
  LayoutDashboard, 
  ClipboardCheck, 
  History, 
  LogOut,
  Database,
  Menu,
  X,
  PackagePlus,
  PackageMinus
} from 'lucide-react';
import { useState } from 'react';

export function Layout() {
  const { user, isAdmin, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackup = async () => {
    try {
      const filePath = await save({
        filters: [{
          name: 'SQLite Database',
          extensions: ['db', 'sqlite']
        }],
        defaultPath: 'stock_backup.db'
      });
      
      if (filePath) {
        await invoke('backup_database', { destPath: filePath });
        alert('Backup berhasil disimpan!');
      }
    } catch (error) {
      alert(`Backup gagal: ${error}`);
    }
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/products', icon: Package, label: 'Produk' },
    { path: '/stock-in', icon: PackagePlus, label: 'Stok Masuk' },
    { path: '/stock-out', icon: PackageMinus, label: 'Stok Keluar' },
    { path: '/stock-opname', icon: ClipboardCheck, label: 'Stock Opname' },
    { path: '/transactions', icon: History, label: 'Transaksi' },
    ...(isAdmin() ? [{ path: '/brand', icon: Database, label: 'Brand' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shadow-xl transform transition-transform duration-200 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-[hsl(var(--sidebar-accent))]/30">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary rounded-lg">
                <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Stock Opname</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User Info Section */}
        <div className="px-6 py-6">
          <div className="bg-[hsl(var(--sidebar-accent))]/80 p-4 rounded-xl border border-[hsl(var(--sidebar-accent))]">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--sidebar-foreground))]/60 font-semibold mb-1">Signed in as</p>
            <div className="flex items-center justify-between">
                <p className="font-medium text-sm truncate max-w-[120px]" title={user?.username}>{user?.username}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    user?.role === 'admin' 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                    {user?.role?.toUpperCase()}
                </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/20 text-blue-300 border border-blue-500/20 shadow-sm'
                    : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-blue-400' : 'text-[hsl(var(--sidebar-foreground))]/50 group-hover:text-white'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[hsl(var(--sidebar-accent))]/30 space-y-3 bg-[hsl(var(--sidebar-background))]">
            {isAdmin() && (
                <Button 
                variant="outline" 
                className="w-full justify-start bg-transparent border-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white transition-colors"
                onClick={handleBackup}
                >
                <Database className="mr-2 h-4 w-4" />
                Backup Database
                </Button>
            )}
            
            <Button 
                variant="ghost" 
                className="w-full justify-start text-red-400/80 hover:text-red-300 hover:bg-red-500/10"
                onClick={handleLogout}
            >
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
            </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 shadow z-40 flex items-center px-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-4 font-bold">Stock Opname</span>
      </header>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`lg:ml-64 min-h-screen pt-16 lg:pt-0`}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
