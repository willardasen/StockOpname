import { useState } from 'react';
import { useProductStore } from '@/stores';
import type { Product, CreateProductInput } from '@/types/database';
import { format } from 'date-fns';

export function useProductForm() {
    const {
        createProduct,
        updateProduct,
        deleteProduct,
        loadProducts,
        setSelectedProduct,
        selectedProduct
    } = useProductStore();

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<CreateProductInput>({
        name: '',
        brand: '',
        brand_type: '',
        type_number: '',
        color: '',
        stock: 0,
        min_stock: 5,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
        note: '',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            brand: '',
            brand_type: '',
            type_number: '',
            color: '',
            stock: 0,
            min_stock: 5,
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            note: '',
        });
    };

    const handleAddNew = () => {
        setSelectedProduct(null);
        resetForm();
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEdit = (product: Product) => {
        setSelectedProduct(product);
        setFormData({
            name: product.name,
            brand: product.brand || '',
            brand_type: product.brand_type || '',
            type_number: product.type_number || '',
            color: product.color || '',
            stock: product.stock,
            min_stock: product.min_stock,
            transaction_date: product.created_at ? product.created_at.split(' ')[0] : format(new Date(), 'yyyy-MM-dd'),
            note: 'Stok Awal',
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditing && selectedProduct) {
            // When editing, exclude only stock (stock should only change via transactions)
            const { stock: _stock, ...editData } = formData;
            await updateProduct({ id: selectedProduct.id, ...editData });
        } else {
            await createProduct(formData);
        }

        setShowModal(false);
        loadProducts();
    };

    const handleDelete = async () => {
        if (selectedProduct && confirm('Yakin ingin menghapus produk ini?')) {
            await deleteProduct(selectedProduct.id);
            setShowModal(false);
            loadProducts();
        }
    };

    // Delete product by ID (for direct delete from table)
    const handleDeleteProduct = async (productId?: number) => {
        const idToDelete = productId ?? selectedProduct?.id;
        if (idToDelete) {
            await deleteProduct(idToDelete);
            setShowModal(false);
            loadProducts();
        }
    };

    return {
        showModal,
        setShowModal,
        isEditing,
        formData,
        setFormData,
        handleAddNew,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDeleteProduct
    };
}
