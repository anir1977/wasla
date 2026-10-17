export type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "SHIPPED";
export type Variant = {
  id: string;
  store_id: string;
  product_id: string;
  size: string;
  color: string;
  stock: number;
};
export type Product = {
  id: string;
  store_id: string;
  name: string;
  description: string;
  price_mad: number;
  active: boolean;
  created_at: string;
  variants: Variant[];
};
export type Store = {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  logo_path: string | null;
  delivery_casa: number;
  delivery_other: number;
  ai_enabled: boolean;
  created_at: string;
};
export type Order = {
  id: string;
  store_id: string;
  customer_name: string;
  phone: string;
  city: string;
  address: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price_mad: number;
  delivery_fee_mad: number;
  total_mad: number;
  status: Status;
  created_at: string;
  source_message_id: string;
};
export type Workspace = {
  store: Store;
  products: Product[];
  orders: Order[];
  demo: boolean;
  email: string;
};
