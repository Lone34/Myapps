// src/screens/CartScreen.js
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect, Link } from 'expo-router';
import { fetchCart, removeFromCart, addToCart } from '../redux/actions/cartActions';

const CartScreen = () => {
  const dispatch = useDispatch();

  const cart = useSelector((state) => state.cart || {});
  const {
    loading,
    error,
    cartItems = [],
    itemsPrice = 0,
    shippingPrice = 0,
    taxPrice = 0,
    totalPrice = 0,
  } = cart;

  // Load cart whenever this tab/screen comes into focus
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCart());
    }, [dispatch])
  );

  const handleRemove = async (variationId) => {
    try {
      await dispatch(removeFromCart(variationId));
    } catch (e) {
      alert(e?.message || 'Failed to remove item');
    }
  };

  const handleQtyChange = async (variationId, nextQty) => {
    if (nextQty < 1) {
      await handleRemove(variationId);
      return;
    }
    try {
      await dispatch(addToCart(variationId, nextQty, true));
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || 'Failed to update quantity');
    }
  };

  const totalItems = cartItems.reduce(
    (sum, it) => sum + Number(it.quantity || 0),
    0
  );

  const renderItem = ({ item }) => {
    const product = item.product || {};
    const variation = item.variation || {};
    const unitPrice =
      Number(item.price) ||
      Number(variation.price) ||
      Number(product.price) ||
      0;
    const mrp = Number(item.mrp || product.mrp || 0);
    const hasDiscount = mrp > unitPrice;

    return (
      <View style={styles.cartItem}>
        <Link
          href={`/product/${product.id}`}
          asChild
        >
          <TouchableOpacity style={styles.imageWrapper}>
            <Image
              source={{ uri: product.image }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </Link>

        <View style={styles.itemInfo}>
          <Link href={`/product/${product.id}`} asChild>
            <TouchableOpacity>
              <Text style={styles.itemName} numberOfLines={2}>
                {product.name}
              </Text>
            </TouchableOpacity>
          </Link>

          {variation.value && (
            <Text style={styles.variationText}>
              {variation.name ? `${variation.name}: ` : ''}
              {variation.value}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              ₹{(unitPrice * item.quantity).toFixed(2)}
            </Text>
            {hasDiscount && (
              <Text style={styles.mrp}>
                ₹{(mrp * item.quantity).toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.actionsRow}>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                onPress={() =>
                  handleQtyChange(item.variation_id, Number(item.quantity) - 1)
                }
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                onPress={() =>
                  handleQtyChange(item.variation_id, Number(item.quantity) + 1)
                }
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleRemove(item.variation_id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading && cartItems.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && cartItems.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Link href="/" asChild>
          <TouchableOpacity>
            <Text style={styles.emptyLink}>Browse products</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Shopping Cart
        <Text style={styles.headerCount}> ({totalItems} item{totalItems !== 1 ? 's' : ''})</Text>
      </Text>

      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => `${item.variation_id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>₹{totalPrice.toFixed(2)}</Text>
          <Text style={styles.summarySub}>
            Items ₹{itemsPrice.toFixed(2)} • Shipping ₹{shippingPrice.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => {
            // For now, mirror web: go to a checkout/summary screen later.
            alert('Checkout flow coming next (same as website).');
          }}
        >
          <Text style={styles.checkoutText}>Proceed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // match your app dark bg
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 16,
    marginVertical: 6,
    padding: 10,
  },
  imageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'space-between',
  },
  itemName: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '600',
  },
  variationText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  price: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  mrp: {
    color: '#6b7280',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
  },
  qtyText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginHorizontal: 8,
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  removeText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.4,
    borderTopColor: '#27272a',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  summaryValue: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
  },
  summarySub: {
    color: '#6b7280',
    fontSize: 10,
  },
  checkoutBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  checkoutText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: '#f87171',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#f9fafb',
    fontSize: 18,
    marginBottom: 10,
  },
  emptyLink: {
    color: '#f97316',
    fontSize: 14,
  },
});
