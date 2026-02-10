import { useState, useEffect, useMemo } from 'react';
import { useBrandStore } from '@/stores';

export interface ProductFilter {
  brand: string;
  brandType: string;
  typeNumber: string;
  color: string;
}

interface ProductFilterBarProps {
  onFilterChange: (filter: ProductFilter) => void;
  className?: string;
}

export function ProductFilterBar({ onFilterChange, className }: ProductFilterBarProps) {
  const { brands, brandTypes, typeNumbers, colors, loadAll } = useBrandStore();

  const [brand, setBrand] = useState('');
  const [brandType, setBrandType] = useState('');
  const [typeNumber, setTypeNumber] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (brands.length === 0) loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get selected brand's id for mapping
  const selectedBrandId = useMemo(() => {
    if (!brand) return null;
    const found = brands.find(b => b.name === brand);
    return found?.id ?? null;
  }, [brand, brands]);

  // Filter brandTypes by selected brand
  const filteredBrandTypes = useMemo(() => {
    if (!selectedBrandId) return brandTypes;
    return brandTypes.filter(t => t.brand_id === selectedBrandId);
  }, [selectedBrandId, brandTypes]);

  // Filter typeNumbers by selected brand
  const filteredTypeNumbers = useMemo(() => {
    if (!selectedBrandId) return typeNumbers;
    return typeNumbers.filter(t => t.brand_id === selectedBrandId);
  }, [selectedBrandId, typeNumbers]);

  // When brand changes, reset dependent filters
  useEffect(() => {
    setBrandType('');
    setTypeNumber('');
  }, [brand]);

  // Notify parent on any change
  useEffect(() => {
    onFilterChange({ brand, brandType, typeNumber, color });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, brandType, typeNumber, color]);

  const selectClass =
    'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      {/* Brand */}
      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        className={selectClass}
      >
        <option value="">Semua Brand</option>
        {brands.map((b) => (
          <option key={b.id} value={b.name}>{b.name}</option>
        ))}
      </select>

      {/* Tipe */}
      <select
        value={brandType}
        onChange={(e) => setBrandType(e.target.value)}
        className={`${selectClass} ${!brand ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
        disabled={!brand}
      >
        <option value="">Semua Tipe</option>
        {filteredBrandTypes.map((t) => (
          <option key={t.id} value={t.name}>{t.name}</option>
        ))}
      </select>

      {/* No Tipe */}
      <select
        value={typeNumber}
        onChange={(e) => setTypeNumber(e.target.value)}
        className={`${selectClass} ${!brand ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
        disabled={!brand}
      >
        <option value="">Semua No Tipe</option>
        {filteredTypeNumbers.map((n) => (
          <option key={n.id} value={n.name}>{n.name}</option>
        ))}
      </select>

      {/* Warna */}
      <select
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className={selectClass}
      >
        <option value="">Semua Warna</option>
        {colors.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      {/* Reset button */}
      {(brand || brandType || typeNumber || color) && (
        <button
          type="button"
          onClick={() => {
            setBrand('');
            setBrandType('');
            setTypeNumber('');
            setColor('');
          }}
          className="h-9 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent text-muted-foreground"
        >
          Reset Filter
        </button>
      )}
    </div>
  );
}
