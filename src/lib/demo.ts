import type { Workspace, Product, Order } from "./types";
const storeId = "11111111-1111-4111-8111-111111111111";
export const demoStore = {
  id: storeId,
  owner_id: storeId,
  name: "Atelier Casa",
  phone: "+212 708 025 467",
  logo_path: null,
  delivery_casa: 20,
  delivery_other: 35,
  ai_enabled: true,
  created_at: "2026-10-01T09:00:00Z",
};
const catalog = [
  ["T-shirt Oversize", "Coton épais, coupe décontractée", 149, "Noir", 42],
  ["Ensemble Urban", "Ensemble deux pièces, coupe relax", 349, "Sable", 18],
  ["Hoodie Essential", "Molleton doux, collection automne", 249, "Olive", 28],
  ["Chemise Linen", "Lin mélangé, manches longues", 229, "Écru", 12],
  ["Pantalon Cargo", "Coupe droite, poches latérales", 279, "Noir", 7],
  ["Sweat Signature", "Broderie ton sur ton, coton", 219, "Gris", 0],
] as const;
export const demoProducts: Product[] = catalog.map(
  ([name, description, price_mad, color, stock], i) => {
    const id = `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`;
    return {
      id,
      store_id: storeId,
      name,
      description,
      price_mad,
      active: true,
      created_at: "2026-10-01T09:00:00Z",
      variants: ["S", "M", "L", "XL"].map((size, j) => ({
        id: `33333333-3333-4333-8333-${String(i * 4 + j + 1).padStart(12, "0")}`,
        store_id: storeId,
        product_id: id,
        size,
        color,
        stock: Math.floor(stock / 4) + (j < stock % 4 ? 1 : 0),
      })),
    };
  },
);
const people = [
  [
    "Salma Bennani",
    "Casablanca",
    "T-shirt Oversize",
    "M",
    "Noir",
    149,
    "CONFIRMED",
  ],
  [
    "Yassine El Amrani",
    "Rabat",
    "Ensemble Urban",
    "L",
    "Sable",
    349,
    "PENDING",
  ],
  [
    "Imane Alaoui",
    "Marrakech",
    "Hoodie Essential",
    "S",
    "Olive",
    249,
    "CONFIRMED",
  ],
  ["Mehdi Tazi", "Tanger", "Pantalon Cargo", "L", "Noir", 279, "SHIPPED"],
  [
    "Nora Berrada",
    "Casablanca",
    "Chemise Linen",
    "M",
    "Écru",
    229,
    "CONFIRMED",
  ],
  [
    "Amine Idrissi",
    "Agadir",
    "T-shirt Oversize",
    "XL",
    "Noir",
    149,
    "CANCELLED",
  ],
  ["Lina Chraïbi", "Fès", "Hoodie Essential", "M", "Olive", 249, "PENDING"],
  [
    "Omar Mansouri",
    "Casablanca",
    "Ensemble Urban",
    "L",
    "Sable",
    349,
    "CONFIRMED",
  ],
] as const;
export const demoOrders: Order[] = people.map(
  (
    [customer_name, city, product_name, size, color, unit_price_mad, status],
    i,
  ) => ({
    id: `44444444-4444-4444-8444-${String(i + 1).padStart(12, "0")}`,
    store_id: storeId,
    customer_name,
    phone: "+21260000000" + i,
    city,
    address: "Adresse fictive · quartier Centre",
    product_name,
    size,
    color,
    quantity: 1,
    unit_price_mad,
    delivery_fee_mad: city === "Casablanca" ? 20 : 35,
    total_mad: unit_price_mad + (city === "Casablanca" ? 20 : 35),
    status,
    created_at: `2026-10-16T${String(12 - Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "12" : "34"}:00Z`,
    source_message_id: "demo-" + i,
  }),
);
export const demoWorkspace: Workspace = {
  store: demoStore,
  products: demoProducts,
  orders: demoOrders,
  demo: true,
  email: "demo@atelier-casa.ma",
};
