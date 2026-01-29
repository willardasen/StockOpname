import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  onSearch,
  placeholder = 'Cari...',
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [value, setValue] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((searchValue: string) => {
      onSearch(searchValue);
    }, debounceMs),
    [debounceMs] // onSearch is excluded to prevent recreation on every render if onSearch changes
  );

  useEffect(() => {
    debouncedSearch(value);
    return () => debouncedSearch.cancel?.();
  }, [value, debouncedSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}

// Simple debounce utility
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms: number
): T & { cancel?: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T & { cancel?: () => void };
  
  debounced.cancel = () => clearTimeout(timeoutId);
  
  return debounced;
}
