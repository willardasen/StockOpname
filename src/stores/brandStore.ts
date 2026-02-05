import { create } from 'zustand';
import { getDb } from '@/repositories/db';
import type { Brand, BrandType, TypeNumber, Color } from '@/types/database';

interface MasterDataStore {
    brands: Brand[];
    brandTypes: BrandType[];
    typeNumbers: TypeNumber[];
    colors: Color[];
    isLoading: boolean;
    error: string | null;

    loadAll: () => Promise<void>;

    addBrand: (name: string, pcsPerBox: number) => Promise<{ success: boolean; message?: string }>;
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
            const db = await getDb();
            const brands = await db.select<Brand[]>('SELECT * FROM brands ORDER BY name ASC');
            const brandTypes = await db.select<BrandType[]>('SELECT * FROM brand_types ORDER BY name ASC');
            const typeNumbers = await db.select<TypeNumber[]>('SELECT * FROM type_numbers ORDER BY name ASC');
            const colors = await db.select<Color[]>('SELECT * FROM colors ORDER BY name ASC');

            set({ brands, brandTypes, typeNumbers, colors });
        } catch (error) {
            console.error('Failed to load master data:', error);
            set({ error: 'Gagal memuat master data' });
        } finally {
            set({ isLoading: false });
        }
    },

    addBrand: async (name: string, pcsPerBox: number) => {
        try {
            const currentBrands = get().brands;
            if (currentBrands.some(b => b.name.toLowerCase() === name.toLowerCase())) {
                return { success: false, message: 'Brand sudah terdaftar!' };
            }

            const db = await getDb();
            console.log(`Adding Brand: ${name}, Pcs/Box: ${pcsPerBox}`);
            await db.execute('INSERT INTO brands (name, pcs_per_box) VALUES (?, ?)', [name, pcsPerBox]);
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add brand:', error);
            return { success: false, message: 'Gagal menambah Brand' };
        }
    },

    deleteBrand: async (id: number) => {
        try {
            const db = await getDb();
            await db.execute('DELETE FROM brands WHERE id = ?', [id]);
            await get().loadAll();
            return true;
        } catch (error) {
            console.error('Failed to delete brand:', error);
            return false;
        }
    },

    addBrandType: async (name: string, brandId: number) => {
        try {
            const currentTypes = get().brandTypes;
            if (currentTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.brand_id === brandId)) {
                return { success: false, message: 'Tipe Brand ini sudah ada untuk Brand terpilih!' };
            }

            const db = await getDb();
            console.log(`Adding BrandType: ${name}, brandId: ${brandId}`);
            await db.execute('INSERT INTO brand_types (name, brand_id) VALUES (?, ?)', [name, brandId]);
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add brand type:', error);
            return { success: false, message: 'Gagal menambah Tipe Brand' };
        }
    },

    deleteBrandType: async (id: number) => {
        try {
            const db = await getDb();
            await db.execute('DELETE FROM brand_types WHERE id = ?', [id]);
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

            const db = await getDb();
            console.log(`Adding TypeNumber: ${name}, brandId: ${brandId}`);
            await db.execute('INSERT INTO type_numbers (name, brand_id) VALUES (?, ?)', [name, brandId]);
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add type number:', error);
            return { success: false, message: 'Gagal menambah No. Tipe' };
        }
    },

    deleteTypeNumber: async (id: number) => {
        try {
            const db = await getDb();
            await db.execute('DELETE FROM type_numbers WHERE id = ?', [id]);
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

            const db = await getDb();
            await db.execute('INSERT INTO colors (name) VALUES (?)', [name]);
            await get().loadAll();
            return { success: true };
        } catch (error) {
            console.error('Failed to add color:', error);
            return { success: false, message: 'Gagal menambah Warna' };
        }
    },

    deleteColor: async (id: number) => {
        try {
            const db = await getDb();
            await db.execute('DELETE FROM colors WHERE id = ?', [id]);
            await get().loadAll();
            return true;
        } catch (error) {
            console.error('Failed to delete color:', error);
            return false;
        }
    },
}));
