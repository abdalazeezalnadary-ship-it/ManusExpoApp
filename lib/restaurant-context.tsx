import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { RESTAURANT_BRANCHES, type BranchCode } from "@/constants/restaurant";
import type { MenuProduct } from "@/lib/menu-data";

const BRANCH_KEY = "dreamcity.branch.v1";
const CART_KEY = "dreamcity.cart.v1";
const ORDER_TYPE_KEY = "dreamcity.order-type.v1";
const TABLE_NUMBER_KEY = "dreamcity.table-number.v1";
export type RestaurantOrderType = "delivery" | "pickup" | "table";

export type CartLine = Pick<MenuProduct, "id" | "name" | "priceYER" | "station" | "categoryKey"> & {
  quantity: number;
};

type RestaurantContextValue = {
  branchCode: BranchCode;
  branch: (typeof RESTAURANT_BRANCHES)[number];
  setBranchCode: (code: BranchCode) => Promise<void>;
  orderType: RestaurantOrderType;
  setOrderType: (type: RestaurantOrderType) => void;
  tableNumber: string;
  setTableNumber: (value: string) => void;
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: MenuProduct) => void;
  changeQuantity: (productCode: string, delta: number) => void;
  clearCart: () => void;
};

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [branchCode, setBranch] = useState<BranchCode>("dream-city-main");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderTypeState] = useState<RestaurantOrderType>("delivery");
  const [tableNumber, setTableNumberState] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(BRANCH_KEY), AsyncStorage.getItem(CART_KEY), AsyncStorage.getItem(ORDER_TYPE_KEY), AsyncStorage.getItem(TABLE_NUMBER_KEY)])
      .then(([branchValue, cartValue, orderTypeValue, tableNumberValue]) => {
        if (!mounted) return;
        if (branchValue === "dream-city-main" || branchValue === "crispy-meals") setBranch(branchValue);
        if (orderTypeValue === "delivery" || orderTypeValue === "pickup" || orderTypeValue === "table") setOrderTypeState(orderTypeValue);
        if (tableNumberValue) setTableNumberState(tableNumberValue);
        if (cartValue) {
          const parsed = JSON.parse(cartValue) as CartLine[];
          if (Array.isArray(parsed)) setCart(parsed.filter((item) => item.quantity > 0));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(BRANCH_KEY, branchCode).catch(() => undefined);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => undefined);
    AsyncStorage.setItem(ORDER_TYPE_KEY, orderType).catch(() => undefined);
    AsyncStorage.setItem(TABLE_NUMBER_KEY, tableNumber).catch(() => undefined);
  }, [branchCode, cart, orderType, tableNumber, hydrated]);

  const setBranchCode = useCallback(async (code: BranchCode) => {
    if (code !== branchCode) setCart([]);
    setBranch(code);
    if (code !== branchCode) await AsyncStorage.setItem(CART_KEY, "[]").catch(() => undefined);
    await AsyncStorage.setItem(BRANCH_KEY, code).catch(() => undefined);
  }, [branchCode]);

  const setOrderType = useCallback((type: RestaurantOrderType) => setOrderTypeState(type), []);
  const setTableNumber = useCallback((value: string) => setTableNumberState(value), []);

  const addToCart = useCallback((product: MenuProduct) => {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, {
        id: product.id,
        name: product.name,
        priceYER: product.priceYER,
        station: product.station,
        categoryKey: product.categoryKey,
        quantity: 1,
      }];
    });
  }, []);

  const changeQuantity = useCallback((productCode: string, delta: number) => {
    setCart((current) => current
      .map((line) => line.id === productCode ? { ...line, quantity: line.quantity + delta } : line)
      .filter((line) => line.quantity > 0));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const branch = RESTAURANT_BRANCHES.find((item) => item.code === branchCode) ?? RESTAURANT_BRANCHES[0]!;
  const value = useMemo(() => ({
    branchCode,
    branch,
    setBranchCode,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    cart,
    cartCount: cart.reduce((total, line) => total + line.quantity, 0),
    cartTotal: cart.reduce((total, line) => total + line.priceYER * line.quantity, 0),
    addToCart,
    changeQuantity,
    clearCart,
  }), [branchCode, branch, setBranchCode, orderType, setOrderType, tableNumber, setTableNumber, cart, addToCart, changeQuantity, clearCart]);

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant() {
  const value = useContext(RestaurantContext);
  if (!value) throw new Error("useRestaurant must be used inside RestaurantProvider");
  return value;
}
