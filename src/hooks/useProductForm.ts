import { useState } from 'react';
import { useProductStore } from '@/stores';
import type { Product, CreateProductInput } from '@/types/database';

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
        buy_price: 0,
        sell_price: 0,
        stock: 0,
        min_stock: 5,
    });

    const resetForm = () => {
        setFormData({
            name: '',
            brand: '',
            brand_type: '',
            type_number: '',
            color: '',
            buy_price: 0,
            sell_price: 0,
            stock: 0,
            min_stock: 5,
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
            buy_price: product.buy_price,
            sell_price: product.sell_price,
            stock: product.stock,
            min_stock: product.min_stock,
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditing && selectedProduct) {
            await updateProduct({ id: selectedProduct.id, ...formData });
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
