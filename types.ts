
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
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  month: string;
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
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  timestamp: string;
  paymentMethod: string;
  sellerName: string;
}

export interface AppState {
  user: User | null;
  employees: Employee[];
  salaryPayments: SalaryPayment[];
  expenses: Expense[];
  ingredients: Ingredient[];
  products: Product[];
  sales: Sale[];
}
