// Simulated database with mock data
import { Product, User } from "@/types";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Capinha Rosa Premium",
    description: "Capinha de silicone premium com proteção antichoque",
    price: 29.90,
    image: "https://images.unsplash.com/photo-1592286927505-1def25115558?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Capinha Floral",
    description: "Capinha com design floral elegante",
    price: 32.90,
    image: "https://images.unsplash.com/photo-1580910051074-3edc264f01e3?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 35,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Capinha Mármore",
    description: "Capinha com padrão de mármore moderno",
    price: 34.90,
    image: "https://images.unsplash.com/photo-1601584942745-d59c75c26a40?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Capinha Transparente",
    description: "Capinha transparente de cristal",
    price: 24.90,
    image: "https://images.unsplash.com/photo-1595966915434-f32983b3a5bf?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    name: "Capinha Geometria",
    description: "Capinha com padrões geométricos coloridos",
    price: 31.90,
    image: "https://images.unsplash.com/photo-1511854306585-5f4b5a0e1bf4?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "6",
    name: "Capinha Minimalista",
    description: "Capinha com design minimalista em tons neutros",
    price: 27.90,
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop",
    category: "Capinhas",
    stock: 55,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockAdminUser: User = {
  id: "admin",
  username: "admin",
  password: "admin123", // In production, this should be hashed
  createdAt: new Date().toISOString(),
};

// Store products in localStorage (for demo purposes)
export const getStoredProducts = (): Product[] => {
  if (typeof window === "undefined") return mockProducts;
  const stored = localStorage.getItem("products");
  return stored ? JSON.parse(stored) : mockProducts;
};

export const saveProducts = (products: Product[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("products", JSON.stringify(products));
};
