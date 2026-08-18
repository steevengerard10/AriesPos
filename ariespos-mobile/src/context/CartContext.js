import React, { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [receivedCash, setReceivedCash] = useState('');
  const [discount, setDiscount] = useState('0');
  const [note, setNote] = useState('');

  const addItem = (product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock || item.quantity + quantity), total: (Math.min(item.quantity + quantity, product.stock || item.quantity + quantity)) * Number(product.precio || product.precio_unitario || 0) }
            : item
        );
      }
      return [
        ...current,
        {
          ...product,
          quantity,
          total: quantity * Number(product.precio || product.precio_unitario || 0),
        },
      ];
    });
  };

  const updateItemQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              total: quantity * Number(item.precio || item.precio_unitario || 0),
            }
          : item
      )
    );
  };

  const removeItem = (itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setCustomer(null);
    setPaymentMethod('Efectivo');
    setReceivedCash('');
    setDiscount('0');
    setNote('');
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.total || 0), 0), [items]);
  const discountValue = Number(discount || 0);
  const tax = subtotal * 0.16;
  const total = Math.max(0, subtotal - discountValue + tax);
  const change = paymentMethod === 'Efectivo' ? Math.max(0, Number(receivedCash || 0) - total) : 0;

  return (
    <CartContext.Provider
      value={{
        items,
        customer,
        paymentMethod,
        receivedCash,
        discount,
        note,
        subtotal,
        tax,
        total,
        change,
        addItem,
        updateItemQuantity,
        removeItem,
        clearCart,
        setCustomer,
        setPaymentMethod,
        setReceivedCash,
        setDiscount,
        setNote,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
