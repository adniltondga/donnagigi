export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  password: string; // hash
  createdAt: string;
}

export interface Order {
  id: string;
  products: Product[];
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  createdAt: string;
}
