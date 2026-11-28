import { create } from 'zustand';
import { MasterRepo } from '@/repositories/MasterRepo';
import type { Brand, BrandType, TypeNumber, Color } from '@/types/database';

interface MasterDataStore {
    brands: Brand[];
    brandTypes: BrandType[];
    typeNumbers: TypeNumber[];
    colors: Color[];
    isLoading: boolean;
    error: string | null;

    loadAll: () => Promise<void>;

    addBrand: (name: string, pcsPerBox: number, calculationType: 'BOX' | 'SIZE') => Promise<{ success: boolean; message?: string }>;
    deleteBrand: (id: number) => Promise<boolean>;

    addBrandType: (name: string, brandId: number) => Promise<{ success: boolean; message?: string }>;
    deleteBrandType: (id: number) => Promise<boolean>;

    addTypeNumber: (name: string, brandId: number) => Promise<{ success: boolean; message?: string }>;
    deleteTypeNumber: (id: number) => Promise<boolean>;

    addColor: (name: string) => Promise<{ success: boolean; message?: string }>;
    deleteColor: (id: number) => Promise<boolean>;
}

export const useBrandStore = create<MasterDataStore>((set, get) => ({
    brands: [],
    brandTypes: [],
    typeNumbers: [],
    colors: [],
    isLoading: false,
    error: null,

    loadAll: async () => {
        set({ isLoading: true, error: null });
        try {
            set(await MasterRepo.list());
        } catch (error) {
            console.error('Failed to load master data:', error);
            set({ error: 'Gagal memuat master data' });
        } finally {
            set({ isLoading: false });
        }
    },

    addBrand: async (name: string, pcsPerBox: number, calculationType: 'BOX' | 'SIZE' = 'BOX') => {
        try {
            const currentBrands = get().brands;
            if (currentBrands.some(b => b.name.toLowerCase() === name.toLowerCase())) {
                return { success: false, message: 'Brand sudah terdaftar!' };
            }

            await MasterRepo.write('brands', { name, pcs_per_box: pcsPerBox, calculation_type: calculationType });
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add brand:', error);
            return { success: false, message: 'Gagal menambah Brand' };
        }
    },

    deleteBrand: async (id: number) => {
        try {
            await MasterRepo.write('brands', { id });
            await get().loadAll();
            return true;
        } catch (error) {
            set({ error: String(error) });
            alert(String(error));
            return false;
        }
    },

    addBrandType: async (name: string, brandId: number) => {
        try {
            const currentTypes = get().brandTypes;
            if (currentTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.brand_id === brandId)) {
                return { success: false, message: 'Tipe Brand ini sudah ada untuk Brand terpilih!' };
            }

            await MasterRepo.write('brand_types', { name, brand_id: brandId });
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add brand type:', error);
            return { success: false, message: 'Gagal menambah Tipe Brand' };
        }
    },

    deleteBrandType: async (id: number) => {
        try {
            await MasterRepo.write('brand_types', { id });
            await get().loadAll();
            return true;
        } catch (error) {
            console.error('Failed to delete brand type:', error);
            return false;
        }
    },

    addTypeNumber: async (name: string, brandId: number) => {
        try {
            const currentNumbers = get().typeNumbers;
            if (currentNumbers.some(n => n.name.toLowerCase() === name.toLowerCase() && n.brand_id === brandId)) {
                return { success: false, message: 'No. Tipe ini sudah ada untuk Brand terpilih!' };
            }

            await MasterRepo.write('type_numbers', { name, brand_id: brandId });
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add type number:', error);
            return { success: false, message: 'Gagal menambah No. Tipe' };
        }
    },

    deleteTypeNumber: async (id: number) => {
        try {
            await MasterRepo.write('type_numbers', { id });
            await get().loadAll();
            return true;
        } catch (error) {
            console.error('Failed to delete type number:', error);
            return false;
        }
    },

    addColor: async (name: string) => {
        try {
            const currentColors = get().colors;
            if (currentColors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                return { success: false, message: 'Warna sudah terdaftar!' };
            }

            await MasterRepo.write('colors', { name });
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add color:', error);
            return { success: false, message: 'Gagal menambah Warna' };
        }
    },

    deleteColor: async (id: number) => {
        try {
            await MasterRepo.write('colors', { id });
            await get().loadAll();
            return true;
        } catch (error) {
            console.error('Failed to delete color:', error);
            return false;
        }
    },
}));
