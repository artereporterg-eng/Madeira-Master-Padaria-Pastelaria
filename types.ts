
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export enum EmployeeCategory {
  BAKER = 'Padeiro',
  PASTRY_CHEF = 'Pasteleiro',
  CASHIER = 'Caixa',
  CLEANER = 'Limpeza',
  MANAGER = 'Gerente'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
}

export interface Employee {
  id: string;
  name: string;
  category: EmployeeCategory;
  salary: number;
  hiredDate: string;
  photo?: string;
  curriculum?: string;
  idCard?: string;
  paymentMethod?: 'Mão' | 'Transferência';
  iban?: string;
  signedReceipt?: string; // base64
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  month: string;
  proof?: string; // base64 or URL
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // kg, L, unit
  quantity: number;
  costPerUnit: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  createdAt: string;
  recipe: { ingredientId: string; amount: number }[];
  recipeYield: number; // How many units the recipe produces
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  timestamp: string;
  paymentMethod: string;
  sellerName: string;
  status?: 'active' | 'voided';
}

export interface ProductionLog {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  timestamp: string;
  ingredientsUsed: { ingredientId: string; ingredientName: string; amount: number; unit: string }[];
  sellerName?: string;
}

export interface AppState {
  user: User | null;
  employees: Employee[];
  salaryPayments: SalaryPayment[];
  expenses: Expense[];
  ingredients: Ingredient[];
  products: Product[];
  sales: Sale[];
  productionLogs: ProductionLog[];
}

export interface CompanyInfo {
  name: string;
  nif: string;
  address: string;
  contact: string;
}
