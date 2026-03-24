
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ShoppingCart, 
  Package, 
  Wallet, 
  PieChart, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Printer, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  History,
  ChefHat,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Eye,
  Calendar,
  BarChart2,
  Download,
  CreditCard,
  Banknote,
  Save,
  XCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  User, UserRole, Employee, EmployeeCategory, 
  SalaryPayment, Expense, Ingredient, Product, Sale, SaleItem, ProductionLog, CompanyInfo 
} from './types';
import { getBusinessInsights } from './services/geminiService';
import InvoicePrinter from './src/components/InvoicePrinter';
import { supabase, isSupabaseConfigured, toSnakeCase, toCamelCase, checkConnection } from './supabaseClient';

// --- Default Data ---
const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: '123', role: UserRole.ADMIN },
];

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'view:dashboard', 'view:sales', 'view:inventory', 'view:hr', 'view:finance', 'view:settings', 'view:reports',
    'manage:users', 'manage:employees', 'manage:inventory', 'manage:finance', 'manage:salaries'
  ],
  [UserRole.MANAGER]: [
    'view:dashboard', 'view:sales', 'view:inventory', 'view:hr', 'view:finance', 'view:reports',
    'manage:employees', 'manage:inventory', 'manage:salaries'
  ],
  [UserRole.STAFF]: [
    'view:dashboard', 'view:sales'
  ],
};

// --- Sincronização Offline-First ---
const compressImage = (base64Str: string, maxWidth: number = 800, maxHeight: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 70% quality
    };
    img.onerror = () => resolve(base64Str); // Fallback to original if error
  });
};

const saveToLocal = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn(`LocalStorage quota exceeded for key "${key}". Attempting recovery...`);
      
      if (key === 'products' && Array.isArray(data)) {
        // If products are too large, try saving without images as a fallback
        const dataWithoutImages = data.map(p => ({ ...p, image: undefined }));
        try {
          localStorage.setItem(key, JSON.stringify(dataWithoutImages));
          console.info('Saved products without images to local storage to stay within quota.');
          return;
        } catch (innerError) {
          console.error('Failed to save even without images:', innerError);
        }
      }
      
      // If it's still failing or it's another key, try clearing some old logs
      try {
        const keysToRemove = ['production_logs', 'sales', 'expenses'];
        keysToRemove.forEach(k => {
          if (k !== key) localStorage.removeItem(k);
        });
        localStorage.setItem(key, JSON.stringify(data));
        console.info('Cleared other keys to make room for ' + key);
      } catch (finalError) {
        console.error('Final attempt to save to LocalStorage failed:', finalError);
      }
    } else {
      console.error('Error saving to LocalStorage:', e);
    }
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role].includes(permission);
  };
  
  // App State with Supabase Persistence
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'Madeira Master',
    nif: '5401234567',
    address: 'Rua Principal, Luanda, Angola',
    contact: '+244 923 000 000'
  });
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(isSupabaseConfigured);

  // Efeito de Inicialização: Carrega do LocalStorage primeiro, depois sincroniza com Supabase
  useEffect(() => {
    // Verificar conexão periodicamente
    const interval = setInterval(async () => {
      const status = await checkConnection();
      setIsOnline(status);
    }, 10000);

    // 1. Carregar do LocalStorage (IMEDIATO)
    const localData = {
      users: localStorage.getItem('users'),
      employees: localStorage.getItem('employees'),
      salaryPayments: localStorage.getItem('salary_payments'),
      expenses: localStorage.getItem('expenses'),
      ingredients: localStorage.getItem('ingredients'),
      products: localStorage.getItem('products'),
      sales: localStorage.getItem('sales'),
      productionLogs: localStorage.getItem('production_logs'),
      companyInfo: localStorage.getItem('company_info')
    };

    const parsedUsers = localData.users ? JSON.parse(localData.users) : null;
    if (parsedUsers && parsedUsers.length > 0) setUsers(parsedUsers);
    if (localData.employees) setEmployees(JSON.parse(localData.employees));
    if (localData.salaryPayments) setSalaryPayments(JSON.parse(localData.salaryPayments));
    if (localData.expenses) setExpenses(JSON.parse(localData.expenses));
    if (localData.ingredients) setIngredients(JSON.parse(localData.ingredients));
    if (localData.products) setProducts(JSON.parse(localData.products));
    if (localData.sales) setSales(JSON.parse(localData.sales));
    if (localData.productionLogs) setProductionLogs(JSON.parse(localData.productionLogs));
    if (localData.companyInfo) setCompanyInfo(JSON.parse(localData.companyInfo));

    if (!isSupabaseConfigured) {
      console.log('Supabase não configurado. Operando apenas em modo LocalStorage.');
      return;
    }

    // 2. Sincronizar com Supabase (ASSÍNCRONO)
    const fetchAllData = async () => {
      try {
        const [
          { data: usersData },
          { data: employeesData },
          { data: salaryPaymentsData },
          { data: expensesData },
          { data: ingredientsData },
          { data: productsData },
          { data: salesData },
          { data: productionLogsData },
          { data: companyInfoData }
        ] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('employees').select('*'),
          supabase.from('salary_payments').select('*'),
          supabase.from('expenses').select('*'),
          supabase.from('ingredients').select('*'),
          supabase.from('products').select('*'),
          supabase.from('sales').select('*'),
          supabase.from('production_logs').select('*'),
          supabase.from('company_info').select('*').single()
        ]);

        // Atualizar estados e LocalStorage com dados da nuvem (convertendo snake_case -> camelCase)
        if (usersData && usersData.length > 0) {
          const formatted = usersData.map(toCamelCase);
          setUsers(formatted);
          saveToLocal('users', formatted);
        }
        if (employeesData) {
          const formatted = employeesData.map(toCamelCase);
          setEmployees(formatted);
          saveToLocal('employees', formatted);
        }
        if (salaryPaymentsData) {
          const formatted = salaryPaymentsData.map(toCamelCase);
          setSalaryPayments(formatted);
          saveToLocal('salary_payments', formatted);
        }
        if (expensesData) {
          const formatted = expensesData.map(toCamelCase);
          setExpenses(formatted);
          saveToLocal('expenses', formatted);
        }
        if (ingredientsData) {
          const formatted = ingredientsData.map(toCamelCase);
          setIngredients(formatted);
          saveToLocal('ingredients', formatted);
        }
        if (productsData) {
          const formatted = productsData.map(toCamelCase);
          setProducts(formatted);
          saveToLocal('products', formatted);
        }
        if (salesData) {
          const formatted = salesData.map(toCamelCase);
          setSales(formatted);
          saveToLocal('sales', formatted);
        }
        if (productionLogsData) {
          const formatted = productionLogsData.map(toCamelCase);
          setProductionLogs(formatted);
          saveToLocal('production_logs', formatted);
        }
        if (companyInfoData) {
          const formatted = toCamelCase(companyInfoData);
          setCompanyInfo(formatted);
          saveToLocal('company_info', formatted);
        }
      } catch (error: any) {
        console.error('Erro na sincronização inicial:', error);
      }
    };

    fetchAllData();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.username === loginData.username && u.password === loginData.password);
    if (foundUser) {
      setUser(foundUser);
      // Reset to first allowed tab
      const allowed = ROLE_PERMISSIONS[foundUser.role].filter(p => p.startsWith('view:'));
      const firstTab = allowed[0].split(':')[1];
      if (!ROLE_PERMISSIONS[foundUser.role].includes(`view:${activeTab}`)) {
        setActiveTab(firstTab);
      }
    } else {
      alert('Credenciais inválidas.');
    }
  };

  const handleLogout = () => setUser(null);

  const fetchInsights = async () => {
    setIsAiLoading(true);
    const dataSummary = {
      totalSales: sales.length,
      totalStockValue: products.reduce((acc, p) => acc + (p.stock * p.price), 0),
      ingredientsCount: ingredients.length
    };
    const insight = await getBusinessInsights(dataSummary);
    setAiInsight(insight || '');
    setIsAiLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        {!isSupabaseConfigured && (
          <div className="mb-6 max-w-md w-full bg-amber-100 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
            <div className="flex items-center">
              <AlertTriangle className="text-amber-600 mr-3" size={24} />
              <div>
                <p className="font-bold text-amber-800">Modo Offline</p>
                <p className="text-sm text-amber-700">
                  O Supabase não está configurado. Os dados serão perdidos ao recarregar a página. 
                  Configure as variáveis de ambiente para persistência na nuvem.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-amber-100">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-amber-500 p-4 rounded-full mb-4 text-white shadow-lg">
              <ChefHat size={40} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 text-center">Madeira Master</h1>
            <p className="text-slate-500 font-medium">Padaria & Pastelaria</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Usuário</label>
              <input 
                type="text" 
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
              <input 
                type="password" 
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                required
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-200 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              Aceder ao Sistema
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">© 2024 Madeira Master. Todos os direitos reservados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col no-print fixed h-full z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 text-amber-600 font-bold text-xl">
            <ChefHat size={32} />
            <span className="leading-tight">Madeira<br/><span className="text-sm font-normal text-slate-500">Master</span></span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {hasPermission('view:dashboard') && <NavItem icon={<PieChart size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />}
          {hasPermission('view:sales') && <NavItem icon={<ShoppingCart size={20}/>} label="Vendas / POS" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
          {hasPermission('view:inventory') && <NavItem icon={<Package size={20}/>} label="Estoque & Prod" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />}
          {hasPermission('view:hr') && <NavItem icon={<Users size={20}/>} label="RH & Salários" active={activeTab === 'hr'} onClick={() => setActiveTab('hr')} />}
          {hasPermission('view:finance') && <NavItem icon={<Wallet size={20}/>} label="Financeiro" active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} />}
          {hasPermission('view:reports') && <NavItem icon={<FileText size={20}/>} label="Relatórios" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />}
          {hasPermission('view:settings') && <NavItem icon={<Settings size={20}/>} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-3 bg-slate-50 rounded-xl mb-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{user.username}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8 no-print">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab.replace('inventory', 'Estoque').replace('hr', 'Recursos Humanos').replace('finance', 'Financeiro').replace('settings', 'Configurações').replace('reports', 'Relatórios Periódicos')}</h2>
            <p className="text-slate-500 text-sm">Bem-vindo à gestão centralizada da sua padaria.</p>
          </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                {isOnline ? 'Online' : 'Offline'}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-400 uppercase">Data Atual</p>
                <p className="text-sm font-medium text-slate-700">{new Date().toLocaleDateString('pt-AO')}</p>
              </div>
            </div>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard 
            sales={sales} 
            expenses={expenses} 
            salaryPayments={salaryPayments} 
            aiInsight={aiInsight} 
            isAiLoading={isAiLoading} 
            onFetchAi={fetchInsights} 
          />
        )}
        {activeTab === 'hr' && (
          <HRManager 
            employees={employees} 
            setEmployees={setEmployees} 
            salaryPayments={salaryPayments} 
            setSalaryPayments={setSalaryPayments} 
            hasPermission={hasPermission}
          />
        )}
        {activeTab === 'sales' && (
          <SalesPOS 
            products={products} 
            setProducts={setProducts} 
            sales={sales} 
            setSales={setSales} 
            ingredients={ingredients}
            setIngredients={setIngredients}
            currentUser={user}
            users={users}
            hasPermission={hasPermission}
            companyInfo={companyInfo}
            isOnline={isOnline}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryManager 
            ingredients={ingredients} 
            setIngredients={setIngredients} 
            products={products} 
            setProducts={setProducts} 
            productionLogs={productionLogs}
            setProductionLogs={setProductionLogs}
            hasPermission={hasPermission}
            currentUser={user}
          />
        )}
        {activeTab === 'finance' && (
          <FinanceManager 
            expenses={expenses} 
            setExpenses={setExpenses} 
            sales={sales}
            salaryPayments={salaryPayments}
            employees={employees}
            hasPermission={hasPermission}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsManager 
            productionLogs={productionLogs}
            products={products}
            ingredients={ingredients}
            companyInfo={companyInfo}
          />
        )}
        {activeTab === 'settings' && (
          <UserManager 
            users={users}
            setUsers={setUsers}
            currentUser={user}
            companyInfo={companyInfo}
            setCompanyInfo={setCompanyInfo}
          />
        )}
      </main>
    </div>
  );
};

// --- Helper Components ---

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const Card: React.FC<{ title: string, value: string, subValue?: string, icon: React.ReactNode, trend?: 'up' | 'down' }> = ({ title, value, subValue, icon, trend }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 rounded-2xl text-amber-600">{icon}</div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {trend === 'up' ? '+12%' : '-4%'}
        </span>
      )}
    </div>
    <div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

// --- Page Components ---

const Dashboard: React.FC<{ 
  sales: Sale[], 
  expenses: Expense[], 
  salaryPayments: SalaryPayment[], 
  aiInsight: string, 
  isAiLoading: boolean,
  onFetchAi: () => void 
}> = ({ sales, expenses, salaryPayments, aiInsight, isAiLoading, onFetchAi }) => {
  const activeSales = useMemo(() => sales.filter(s => s.status !== 'voided'), [sales]);
  const totalRevenue = useMemo(() => activeSales.reduce((acc, s) => acc + s.total, 0), [activeSales]);
  const totalExpenses = useMemo(() => 
    expenses.reduce((acc, e) => acc + e.amount, 0) + salaryPayments.reduce((acc, s) => acc + s.amount, 0), 
  [expenses, salaryPayments]);
  const profit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Receita Total" value={`${totalRevenue.toLocaleString()} Kz`} icon={<TrendingUp size={24}/>} trend="up" />
        <Card title="Despesas Totais" value={`${totalExpenses.toLocaleString()} Kz`} icon={<Wallet size={24}/>} trend="down" />
        <Card title="Lucro Bruto" value={`${profit.toLocaleString()} Kz`} icon={<PieChart size={24}/>} trend={profit > 0 ? 'up' : 'down'} />
        <Card title="Total de Vendas" value={activeSales.length.toString()} icon={<ShoppingCart size={24}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Vendas Recentes</h3>
            <button className="text-amber-600 text-xs font-bold uppercase hover:underline">Ver todas</button>
          </div>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-4">Data</th>
                  <th className="pb-4">Itens</th>
                  <th className="pb-4">Total</th>
                  <th className="pb-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {sales.slice(-5).reverse().map(sale => (
                  <tr key={sale.id} className={`group ${sale.status === 'voided' ? 'opacity-50' : ''}`}>
                    <td className="py-4 text-slate-500">{new Date(sale.timestamp).toLocaleDateString()}</td>
                    <td className="py-4 text-slate-800 font-medium">{sale.items.length} itens</td>
                    <td className="py-4 font-bold text-slate-800">{sale.total.toLocaleString()} Kz</td>
                    <td className="py-4">
                      {sale.status === 'voided' ? (
                        <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-[10px] font-bold uppercase">Anulada</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded-md text-[10px] font-bold uppercase">Concluído</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sales.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Nenhuma venda registrada.</p>}
          </div>
        </div>

        <div className="bg-amber-600 rounded-3xl p-8 text-white shadow-xl shadow-amber-200 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-amber-200" />
              <h3 className="font-bold text-lg">Insights Inteligentes</h3>
            </div>
            <p className="text-amber-100 text-sm mb-6 leading-relaxed">
              {aiInsight || "A inteligência artificial analisa seus dados para sugerir melhorias operacionais."}
            </p>
            <button 
              onClick={onFetchAi}
              disabled={isAiLoading}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-6 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {isAiLoading ? 'Analisando...' : 'Atualizar Insights'}
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10">
            <ChefHat size={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

const HRManager: React.FC<{ 
  employees: Employee[], 
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
  salaryPayments: SalaryPayment[],
  setSalaryPayments: React.Dispatch<React.SetStateAction<SalaryPayment[]>>,
  hasPermission: (p: string) => boolean
}> = ({ employees, setEmployees, salaryPayments, setSalaryPayments, hasPermission }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ category: EmployeeCategory.BAKER, paymentMethod: 'Mão' });
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEmpForPayment, setSelectedEmpForPayment] = useState<Employee | null>(null);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);

  const canManage = hasPermission('manage:employees');
  const canPay = hasPermission('manage:salaries');

  const validateEmployee = () => {
    const newErrors: Record<string, string> = {};
    if (!newEmp.name || newEmp.name.trim().length < 3) newErrors.name = 'Nome deve ter pelo menos 3 caracteres';
    if (!newEmp.salary || Number(newEmp.salary) <= 0) newErrors.salary = 'Salário deve ser maior que zero';
    
    if (newEmp.paymentMethod === 'Transferência') {
      if (!newEmp.iban || !newEmp.iban.startsWith('AO06')) newErrors.iban = 'IBAN inválido (deve começar com AO06)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'curriculum' | 'idCard' | 'signedReceipt') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert('Ficheiro muito grande. O limite é 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmp(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveEmployee = async () => {
    if (validateEmployee()) {
      const employeeData: Employee = editingEmpId 
        ? { 
            ...employees.find(e => e.id === editingEmpId)!,
            name: newEmp.name!,
            category: newEmp.category as EmployeeCategory,
            salary: Number(newEmp.salary),
            photo: newEmp.photo,
            curriculum: newEmp.curriculum,
            idCard: newEmp.idCard,
            paymentMethod: newEmp.paymentMethod as 'Mão' | 'Transferência',
            iban: newEmp.iban,
            signedReceipt: newEmp.signedReceipt
          }
        : {
            id: Math.random().toString(36).substr(2, 9),
            name: newEmp.name!,
            category: newEmp.category as EmployeeCategory,
            salary: Number(newEmp.salary),
            hiredDate: new Date().toISOString(),
            photo: newEmp.photo,
            curriculum: newEmp.curriculum,
            idCard: newEmp.idCard,
            paymentMethod: newEmp.paymentMethod as 'Mão' | 'Transferência',
            iban: newEmp.iban,
            signedReceipt: newEmp.signedReceipt
          };

      // 1. Atualizar Estado + LocalStorage (IMEDIATO)
      const updatedEmployees = editingEmpId 
        ? employees.map(emp => emp.id === editingEmpId ? employeeData : emp)
        : [...employees, employeeData];
      
      setEmployees(updatedEmployees);
      saveToLocal('employees', updatedEmployees);
      
      // 2. Sincronizar com Supabase (ASSÍNCRONO)
      const snakeData = toSnakeCase(employeeData);
      if (editingEmpId) {
        supabase.from('employees').update(snakeData).eq('id', editingEmpId).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar funcionário (update):', error);
        });
      } else {
        supabase.from('employees').insert(snakeData).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar funcionário (insert):', error);
        });
      }

      setShowAdd(false);
      setEditingEmpId(null);
      setNewEmp({ category: EmployeeCategory.BAKER, paymentMethod: 'Mão' });
      setErrors({});
    }
  };

  const startEditEmployee = (emp: Employee) => {
    setNewEmp(emp);
    setEditingEmpId(emp.id);
    setShowAdd(true);
  };

  const deleteEmployee = async (id: string) => {
    if (confirm('Tem certeza?')) {
      // 1. Local
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      saveToLocal('employees', updated);

      // 2. Background Sync
      supabase.from('employees').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Erro ao sincronizar exclusão de funcionário:', error);
      });
    }
  };

  const paySalary = async (emp: Employee, proof: string) => {
    const payment: SalaryPayment = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: emp.id,
      amount: emp.salary,
      date: new Date().toISOString(),
      month: new Date().toLocaleString('pt-BR', { month: 'long' }),
      proof: proof
    };

    // 1. Local
    const updated = [...salaryPayments, payment];
    setSalaryPayments(updated);
    saveToLocal('salary_payments', updated);

    // 2. Background Sync
    supabase.from('salary_payments').insert(toSnakeCase(payment)).then(({ error }) => {
      if (error) console.error('Erro ao sincronizar pagamento de salário:', error);
    });
    
    alert(`Salário de ${emp.name} pago com sucesso!`);
    setShowPaymentModal(false);
    setSelectedEmpForPayment(null);
    setPaymentProof(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Gestão de Staff</h3>
        {canManage && (
          <button 
            onClick={() => {
              if (showAdd && editingEmpId) {
                setEditingEmpId(null);
                setNewEmp({ category: EmployeeCategory.BAKER });
              } else {
                setShowAdd(!showAdd);
              }
            }}
            className="bg-amber-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-amber-700 transition-colors"
          >
            {showAdd && editingEmpId ? 'Cancelar Edição' : <><Plus size={18}/> Novo Funcionário</>}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nome Completo</label>
              <input 
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.name ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newEmp.name || ''}
                onChange={e => {
                  setNewEmp({...newEmp, name: e.target.value});
                  if (errors.name) setErrors({...errors, name: ''});
                }}
                placeholder="Ex: João Silva"
              />
              {errors.name && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.name}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                value={newEmp.category}
                onChange={e => setNewEmp({...newEmp, category: e.target.value as EmployeeCategory})}
              >
                {Object.values(EmployeeCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Salário (Kz)</label>
              <input 
                type="number"
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.salary ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newEmp.salary || ''}
                onChange={e => {
                  setNewEmp({...newEmp, salary: e.target.value});
                  if (errors.salary) setErrors({...errors, salary: ''});
                }}
                placeholder="0"
              />
              {errors.salary && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.salary}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Forma de Pagamento</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                value={newEmp.paymentMethod || 'Mão'}
                onChange={e => setNewEmp({...newEmp, paymentMethod: e.target.value as 'Mão' | 'Transferência'})}
              >
                <option value="Mão">Mão (Dinheiro)</option>
                <option value="Transferência">Transferência Bancária</option>
              </select>
            </div>
            {newEmp.paymentMethod === 'Transferência' ? (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">IBAN do Funcionário</label>
                <input 
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.iban ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newEmp.iban || ''}
                  onChange={e => {
                    setNewEmp({...newEmp, iban: e.target.value.toUpperCase()});
                    if (errors.iban) setErrors({...errors, iban: ''});
                  }}
                  placeholder="AO06 0000 0000 0000 0000 0"
                />
                {errors.iban && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.iban}</p>}
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Comprovativo Assinado (Upload)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                    <FileText size={20} className={newEmp.signedReceipt ? "text-amber-600" : "text-slate-400"} />
                  </div>
                  <input type="file" className="text-xs flex-1" onChange={e => handleFileUpload(e, 'signedReceipt')} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Foto Tipo Passe</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                  {newEmp.photo ? <img src={newEmp.photo} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400" />}
                </div>
                <input type="file" accept="image/*" className="text-xs flex-1" onChange={e => handleFileUpload(e, 'photo')} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Curriculum Vitae (PDF/Img)</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                  <FileText size={20} className={newEmp.curriculum ? "text-amber-600" : "text-slate-400"} />
                </div>
                <input type="file" className="text-xs flex-1" onChange={e => handleFileUpload(e, 'curriculum')} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Bilhete de Identidade (Img)</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                  <FileText size={20} className={newEmp.idCard ? "text-amber-600" : "text-slate-400"} />
                </div>
                <input type="file" className="text-xs flex-1" onChange={e => handleFileUpload(e, 'idCard')} />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={saveEmployee} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all">
              {editingEmpId ? 'Atualizar Funcionário' : 'Salvar Funcionário'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group">
            {canManage && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => startEditEmployee(emp)}
                  className="p-1.5 bg-slate-50 text-slate-400 hover:text-amber-600 rounded-lg"
                  title="Editar Funcionário"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => deleteEmployee(emp.id)}
                  className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-lg"
                  title="Excluir Funcionário"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center overflow-hidden border border-amber-100 shadow-inner">
                {emp.photo ? (
                  <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                ) : (
                  <Users size={32} />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-lg">{emp.name}</h4>
                <div className="flex gap-2 items-center">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">{emp.category}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    {emp.paymentMethod === 'Transferência' ? <CreditCard size={12} /> : <Banknote size={12} />}
                    {emp.paymentMethod || 'Mão'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Documentos</span>
                <div className="flex gap-2">
                  {emp.curriculum && (
                    <button 
                      onClick={() => {
                        const win = window.open();
                        win?.document.write(`<iframe src="${emp.curriculum}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                      }}
                      className="p-2 bg-slate-50 text-slate-500 hover:text-amber-600 rounded-lg transition-colors" 
                      title="Ver CV"
                    >
                      <FileText size={16} />
                    </button>
                  )}
                  {emp.idCard && (
                    <button 
                      onClick={() => {
                        const win = window.open();
                        win?.document.write(`<img src="${emp.idCard}" style="max-width: 100%; height: auto;" />`);
                      }}
                      className="p-2 bg-slate-50 text-slate-500 hover:text-amber-600 rounded-lg transition-colors" 
                      title="Ver BI"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {emp.signedReceipt && (
                    <button 
                      onClick={() => {
                        const win = window.open();
                        win?.document.write(`<img src="${emp.signedReceipt}" style="max-width: 100%; height: auto;" />`);
                      }}
                      className="p-2 bg-slate-50 text-slate-500 hover:text-amber-600 rounded-lg transition-colors" 
                      title="Ver Comprovativo"
                    >
                      <FileText size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Salário Mensal</p>
                  <p className="font-bold text-slate-800 text-lg">{emp.salary.toLocaleString()} Kz</p>
                </div>
                {canPay && (
                  <button 
                    onClick={() => {
                      setSelectedEmpForPayment(emp);
                      setShowPaymentModal(true);
                    }}
                    className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-100"
                  >
                    Pagar Agora
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="col-span-full text-center py-20 text-slate-400">Nenhum funcionário cadastrado.</p>}
      </div>

      {showPaymentModal && selectedEmpForPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-800">Confirmar Pagamento</h3>
              <p className="text-slate-500">
                A pagar o salário de <span className="font-bold text-amber-600">{selectedEmpForPayment.name}</span> no valor de <span className="font-bold text-slate-800">{selectedEmpForPayment.salary.toLocaleString()} Kz</span>.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-amber-400 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPaymentProof(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {paymentProof ? (
                  <div className="space-y-2">
                    <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                      <Save size={14} /> Comprovativo Carregado
                    </div>
                    <p className="text-[10px] text-slate-400">Clique para alterar o ficheiro</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Download className="mx-auto text-slate-300" size={32} />
                    <p className="text-sm font-medium text-slate-600">Carregar Comprovativo</p>
                    <p className="text-[10px] text-slate-400">Imagem ou PDF (Máx 2MB)</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedEmpForPayment(null);
                    setPaymentProof(null);
                  }}
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={!paymentProof}
                  onClick={() => paySalary(selectedEmpForPayment, paymentProof!)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    paymentProof 
                      ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-100' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Confirmar e Pagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InventoryManager: React.FC<{
  ingredients: Ingredient[],
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>,
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  productionLogs: ProductionLog[],
  setProductionLogs: React.Dispatch<React.SetStateAction<ProductionLog[]>>,
  hasPermission: (p: string) => boolean,
  currentUser: User | null
}> = ({ ingredients, setIngredients, products, setProducts, productionLogs, setProductionLogs, hasPermission, currentUser }) => {
  const [showAddIng, setShowAddIng] = useState(false);
  const [newIng, setNewIng] = useState<Partial<Ingredient>>({ unit: 'kg' });
  const [showAddProd, setShowAddProd] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>({ stock: 0, recipeYield: 1 });
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simProdId, setSimProdId] = useState<string>('');
  const [simQty, setSimQty] = useState<number>(1);
  const [showInitialStock, setShowInitialStock] = useState(false);
  const [initialStockProdId, setInitialStockProdId] = useState<string>('');
  const [initialStockQty, setInitialStockQty] = useState<number>(0);

  const canManage = hasPermission('manage:inventory');

  const groupedIngredients = useMemo(() => {
    const groups: Record<string, { name: string, unit: string, total: number, representativeId: string }> = {};
    ingredients.forEach(ing => {
      const key = `${ing.name.toLowerCase()}-${ing.unit}`;
      if (!groups[key]) {
        groups[key] = { name: ing.name, unit: ing.unit, total: 0, representativeId: ing.id };
      }
      groups[key].total += ing.quantity;
    });
    return Object.values(groups);
  }, [ingredients]);

  const registerInitialStock = async () => {
    if (!initialStockProdId || initialStockQty <= 0) {
      alert('Selecione um produto e uma quantidade válida!');
      return;
    }
    const product = products.find(p => p.id === initialStockProdId);
    if (!product) return;

    const newStock = product.stock + initialStockQty;

    // 1. Local
    const updated = products.map(p => p.id === initialStockProdId ? { ...p, stock: newStock } : p);
    setProducts(updated);
    saveToLocal('products', updated);

    // 2. Background Sync
    supabase.from('products').update({ stock: newStock }).eq('id', initialStockProdId).then(({ error }) => {
      if (error) console.error('Erro ao sincronizar estoque inicial:', error);
    });

    alert(`Estoque inicial de ${initialStockQty}x ${product.name} registrado com sucesso!`);
    setInitialStockProdId('');
    setInitialStockQty(0);
    setShowInitialStock(false);
  };

  const produceProduct = async () => {
    if (!simProdId) return;
    const product = products.find(p => p.id === simProdId);
    if (!product) return;

    // Check if enough ingredients (by name)
    const missingIngredients: string[] = [];
    product.recipe.forEach(r => {
      const recipeIng = ingredients.find(i => i.id === r.ingredientId);
      if (!recipeIng) return;
      
      const totalAvailable = ingredients
        .filter(i => i.name.toLowerCase() === recipeIng.name.toLowerCase() && i.unit === recipeIng.unit)
        .reduce((acc, i) => acc + i.quantity, 0);
        
      const required = (r.amount / (product.recipeYield || 1)) * simQty;
      if (totalAvailable < required) {
        missingIngredients.push(`${recipeIng.name}: Necessário ${required.toFixed(3)} ${recipeIng.unit} | Disponível ${totalAvailable.toFixed(3)} ${recipeIng.unit} | Falta ${(required - totalAvailable).toFixed(3)} ${recipeIng.unit}`);
      }
    });

    if (missingIngredients.length > 0) {
      alert(`Insumos insuficientes para esta produção:\n\n${missingIngredients.join('\n')}`);
      return;
    }

    // Deduct ingredients (FIFO - First In First Out)
    let tempIngredients = [...ingredients];
    const updates = [];
    
    product.recipe.forEach(r => {
      const recipeIng = ingredients.find(i => i.id === r.ingredientId);
      if (!recipeIng) return;
      
      let amountToDeduct = (r.amount / (product.recipeYield || 1)) * simQty;
      
      tempIngredients = tempIngredients.map(ing => {
        if (ing.name.toLowerCase() === recipeIng.name.toLowerCase() && ing.unit === recipeIng.unit && amountToDeduct > 0) {
          const deduction = Math.min(ing.quantity, amountToDeduct);
          amountToDeduct -= deduction;
          const newQty = ing.quantity - deduction;
          updates.push(supabase.from('ingredients').update({ quantity: newQty }).eq('id', ing.id));
          return { ...ing, quantity: newQty };
        }
        return ing;
      });
    });

    // Increase product stock
    const newProductStock = product.stock + simQty;

    // Record production log
    const newLog: ProductionLog = {
      id: Math.random().toString(36).substr(2, 9),
      productId: simProdId,
      productName: product.name,
      quantity: simQty,
      timestamp: new Date().toISOString(),
      sellerName: currentUser?.username || 'Sistema',
      ingredientsUsed: product.recipe.map(r => {
        const ing = ingredients.find(i => i.id === r.ingredientId);
        return {
          ingredientId: r.ingredientId,
          ingredientName: ing?.name || 'Insumo Desconhecido',
          amount: (r.amount / (product.recipeYield || 1)) * simQty,
          unit: ing?.unit || ''
        };
      })
    };

    // 1. Local
    const updatedProducts = products.map(p => p.id === simProdId ? { ...p, stock: newProductStock } : p);
    setProducts(updatedProducts);
    saveToLocal('products', updatedProducts);
    
    setIngredients(tempIngredients);
    saveToLocal('ingredients', tempIngredients);
    
    const updatedLogs = [...productionLogs, newLog];
    setProductionLogs(updatedLogs);
    saveToLocal('production_logs', updatedLogs);

    // 2. Background Sync
    supabase.from('products').update({ stock: newProductStock }).eq('id', simProdId).then(({ error }) => {
      if (error) console.error('Erro ao sincronizar estoque de produção:', error);
    });
    
    supabase.from('production_logs').insert(toSnakeCase(newLog)).then(({ error }) => {
      if (error) console.error('Erro ao sincronizar log de produção:', error);
    });

    updates.forEach(u => u.then(({ error }) => {
      if (error) console.error('Erro ao sincronizar dedução de insumo:', error);
    }));

    alert(`Produção de ${simQty}x ${product.name} concluída com sucesso!`);
    setSimQty(1);
    setSimProdId('');
  };

  const validateIngredient = () => {
    const newErrors: Record<string, string> = {};
    if (!newIng.name || newIng.name.trim().length < 2) newErrors.ingName = 'Nome obrigatório (min 2 carac.)';
    if (newIng.quantity === undefined || Number(newIng.quantity) < 0) newErrors.ingQty = 'Quantidade inválida';
    if (newIng.costPerUnit !== undefined && Number(newIng.costPerUnit) < 0) newErrors.ingCost = 'Custo inválido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveIngredient = async () => {
    if (validateIngredient()) {
      const ingredientData: Ingredient = editingIngId 
        ? { 
            ...ingredients.find(i => i.id === editingIngId)!,
            name: newIng.name!,
            unit: newIng.unit || 'kg',
            quantity: Number(newIng.quantity),
            costPerUnit: Number(newIng.costPerUnit || 0)
          }
        : {
            id: Math.random().toString(36).substr(2, 9),
            name: newIng.name!,
            unit: newIng.unit || 'kg',
            quantity: Number(newIng.quantity),
            costPerUnit: Number(newIng.costPerUnit || 0),
            createdAt: new Date().toISOString()
          };

      // 1. Atualizar Estado + LocalStorage (IMEDIATO)
      const updatedIngredients = editingIngId 
        ? ingredients.map(ing => ing.id === editingIngId ? ingredientData : ing)
        : [...ingredients, ingredientData];
      
      setIngredients(updatedIngredients);
      saveToLocal('ingredients', updatedIngredients);
      
      // 2. Sincronizar com Supabase (ASSÍNCRONO)
      const snakeData = toSnakeCase(ingredientData);
      if (editingIngId) {
        supabase.from('ingredients').update(snakeData).eq('id', editingIngId).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar insumo (update):', error);
        });
      } else {
        supabase.from('ingredients').insert(snakeData).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar insumo (insert):', error);
        });
      }

      setShowAddIng(false);
      setEditingIngId(null);
      setNewIng({ unit: 'kg' });
      setErrors({});
    }
  };

  const startEditIngredient = (ing: Ingredient) => {
    setNewIng(ing);
    setEditingIngId(ing.id);
    setShowAddIng(true);
  };

  const validateProduct = () => {
    const newErrors: Record<string, string> = {};
    if (!newProd.name || newProd.name.trim().length < 2) newErrors.prodName = 'Nome obrigatório (min 2 carac.)';
    if (!newProd.price || Number(newProd.price) <= 0) newErrors.prodPrice = 'Preço deve ser maior que zero';
    if (!newProd.recipeYield || Number(newProd.recipeYield) <= 0) newErrors.prodYield = 'Rendimento da receita deve ser maior que zero';
    if (newProd.stock !== undefined && Number(newProd.stock) < 0) newErrors.prodStock = 'Estoque inválido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProduct = async () => {
    if (validateProduct()) {
      const recipe = newProd.recipe || [];
      const stockValue = Number(newProd.stock || 0);
      let tempIngredients = [...ingredients];
      const updates = [];
      let newLog: ProductionLog | null = null;

      // If it's a NEW product and has stock + recipe, trigger production logic
    if (!editingProdId && stockValue > 0 && recipe.length > 0) {
        const yieldVal = Number(newProd.recipeYield || 1);
        // Check if enough ingredients (by name)
        const missingIngredients: string[] = [];
        recipe.forEach(r => {
          const recipeIng = ingredients.find(i => i.id === r.ingredientId);
          if (!recipeIng) return;
          
          const totalAvailable = ingredients
            .filter(i => i.name.toLowerCase() === recipeIng.name.toLowerCase() && i.unit === recipeIng.unit)
            .reduce((acc, i) => acc + i.quantity, 0);
            
          const required = (r.amount / yieldVal) * stockValue;
          if (totalAvailable < required) {
            missingIngredients.push(`${recipeIng.name}: Necessário ${required.toFixed(3)} ${recipeIng.unit} | Disponível ${totalAvailable.toFixed(3)} ${recipeIng.unit} | Falta ${(required - totalAvailable).toFixed(3)} ${recipeIng.unit}`);
          }
        });

        if (missingIngredients.length > 0) {
          alert(`Insumos insuficientes para produzir o estoque inicial deste produto:\n\n${missingIngredients.join('\n')}`);
          return;
        }

        // Deduct ingredients (FIFO)
        recipe.forEach(r => {
          const recipeIng = ingredients.find(i => i.id === r.ingredientId);
          if (!recipeIng) return;
          
          let amountToDeduct = (r.amount / yieldVal) * stockValue;
          
          tempIngredients = tempIngredients.map(ing => {
            if (ing.name.toLowerCase() === recipeIng.name.toLowerCase() && ing.unit === recipeIng.unit && amountToDeduct > 0) {
              const deduction = Math.min(ing.quantity, amountToDeduct);
              amountToDeduct -= deduction;
              const newQty = ing.quantity - deduction;
              updates.push(supabase.from('ingredients').update({ quantity: newQty }).eq('id', ing.id));
              return { ...ing, quantity: newQty };
            }
            return ing;
          });
        });

        // Record production log for initial stock
        newLog = {
          id: Math.random().toString(36).substr(2, 9),
          productId: 'new-product', // Placeholder
          productName: newProd.name!,
          quantity: stockValue,
          timestamp: new Date().toISOString(),
          sellerName: currentUser?.username || 'Sistema',
          ingredientsUsed: recipe.map(r => {
            const ing = ingredients.find(i => i.id === r.ingredientId);
            return {
              ingredientId: r.ingredientId,
              ingredientName: ing?.name || 'Insumo Desconhecido',
              amount: (r.amount / yieldVal) * stockValue,
              unit: ing?.unit || ''
            };
          })
        };
        updates.push(supabase.from('production_logs').insert(toSnakeCase(newLog)));
      }

      const productData: Product = editingProdId 
        ? { 
            ...products.find(p => p.id === editingProdId)!,
            name: newProd.name!,
            price: Number(newProd.price),
            stock: Number(newProd.stock),
            image: newProd.image,
            recipe: recipe,
            recipeYield: Number(newProd.recipeYield || 1)
          }
        : {
            id: Math.random().toString(36).substr(2, 9),
            name: newProd.name!,
            price: Number(newProd.price),
            stock: stockValue,
            image: newProd.image,
            createdAt: new Date().toISOString(),
            recipe: recipe,
            recipeYield: Number(newProd.recipeYield || 1)
          };

      if (newLog) newLog.productId = productData.id;

      // 1. Atualizar Estado + LocalStorage (IMEDIATO)
      const updatedProducts = editingProdId 
        ? products.map(p => p.id === editingProdId ? productData : p)
        : [...products, productData];
      
      setProducts(updatedProducts);
      saveToLocal('products', updatedProducts);
      
      if (updates.length > 0) {
        setIngredients(tempIngredients);
        saveToLocal('ingredients', tempIngredients);
        // Se houver log de produção, salvar também
        if (newLog) {
          const updatedLogs = [...productionLogs, newLog];
          setProductionLogs(updatedLogs);
          saveToLocal('production_logs', updatedLogs);
        }
      }

      // 2. Sincronizar com Supabase (ASSÍNCRONO)
      const snakeData = toSnakeCase(productData);
      if (editingProdId) {
        supabase.from('products').update(snakeData).eq('id', editingProdId).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar produto (update):', error);
        });
      } else {
        supabase.from('products').insert(snakeData).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar produto (insert):', error);
        });
      }

      // Executar outros updates (ingredientes e logs)
      updates.forEach(u => u.then(({ error }) => {
        if (error) console.error('Erro ao sincronizar atualização relacionada ao produto:', error);
      }));

      setShowAddProd(false);
      setEditingProdId(null);
      setNewProd({ stock: 0, recipeYield: 1, recipe: [] });
      setErrors({});
    }
  };

  const addRecipeItem = (ingredientId: string, amount: number) => {
    const currentRecipe = newProd.recipe || [];
    const existing = currentRecipe.find(r => r.ingredientId === ingredientId);
    if (existing) {
      setNewProd({
        ...newProd,
        recipe: currentRecipe.map(r => r.ingredientId === ingredientId ? { ...r, amount } : r)
      });
    } else {
      setNewProd({
        ...newProd,
        recipe: [...currentRecipe, { ingredientId, amount }]
      });
    }
  };

  const removeRecipeItem = (ingredientId: string) => {
    setNewProd({
      ...newProd,
      recipe: (newProd.recipe || []).filter(r => r.ingredientId !== ingredientId)
    });
  };

  const startEditProduct = (prod: Product) => {
    setNewProd(prod);
    setEditingProdId(prod.id);
    setShowAddProd(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setNewProd({ ...newProd, image: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-12">
      {/* Resumo de Insumos Totais */}
      <section className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-amber-800">
          <PieChart size={24} />
          <h3 className="text-lg font-bold">Resumo de Estoque Total (Insumos)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {groupedIngredients.map((group, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">{group.name}</p>
              <p className="text-xl font-black text-slate-800">{group.total.toFixed(3)} <span className="text-sm font-normal text-slate-500">{group.unit}</span></p>
            </div>
          ))}
          {groupedIngredients.length === 0 && <p className="col-span-full text-center py-4 text-amber-600/50 italic text-sm">Nenhum insumo para totalizar.</p>}
        </div>
      </section>

      {/* Insumos */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package size={20}/> Matéria Prima (Insumos)</h3>
          {canManage && (
            <button 
              onClick={() => {
                if (showAddIng && editingIngId) {
                  setEditingIngId(null);
                  setNewIng({ unit: 'kg' });
                } else {
                  setShowAddIng(!showAddIng);
                }
              }} 
              className="text-amber-600 bg-white border border-amber-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-50 transition-colors"
            >
              {showAddIng && editingIngId ? 'Cancelar Edição' : 'Adicionar Insumo'}
            </button>
          )}
        </div>
        {showAddIng && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome do Insumo</label>
              <input 
                placeholder="Ex: Farinha" 
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.ingName ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newIng.name || ''} 
                onChange={e => {
                  setNewIng({...newIng, name: e.target.value});
                  if (errors.ingName) setErrors({...errors, ingName: ''});
                }} 
              />
              {errors.ingName && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.ingName}</p>}
              {newIng.name && groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase()) && (
                <p className="text-[10px] text-amber-600 font-bold mt-1 animate-pulse">
                  Total atual em estoque: {groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase())?.total.toFixed(3)} {groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase())?.unit}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quantidade</label>
              <input 
                placeholder="Qtd" 
                type="number" 
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.ingQty ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newIng.quantity || ''} 
                onChange={e => {
                  setNewIng({...newIng, quantity: e.target.value});
                  if (errors.ingQty) setErrors({...errors, ingQty: ''});
                }} 
              />
              {errors.ingQty && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.ingQty}</p>}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidade</label>
              <select className="w-full p-3 border rounded-xl" value={newIng.unit} onChange={e => setNewIng({...newIng, unit: e.target.value})}>
                <option value="kg">Quilos (kg)</option>
                <option value="g">Gramas (g)</option>
                <option value="mg">Mili gramas (mg)</option>
                <option value="L">Litros (L)</option>
                <option value="ml">Mili litros (ml)</option>
                <option value="unit">Unidade</option>
              </select>
            </div>
            <button onClick={saveIngredient} className="bg-amber-600 text-white p-3 rounded-xl font-bold">
              {editingIngId ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {ingredients.map(ing => (
            <div key={ing.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group relative">
              {canManage && (
                <button 
                  onClick={() => startEditIngredient(ing)}
                  className="absolute top-4 right-4 p-1.5 bg-slate-50 text-slate-400 hover:text-amber-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Editar Insumo"
                >
                  <Settings size={14} />
                </button>
              )}
              <h5 className="font-bold text-slate-800 mb-1">{ing.name}</h5>
              <div className="flex justify-between items-center mb-2">
                <p className="text-lg font-bold text-amber-600">{ing.quantity.toFixed(3)} {ing.unit}</p>
                <span className={`w-2 h-2 rounded-full ${ing.quantity < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
              </div>
              <p className="text-[9px] text-slate-400 uppercase font-bold">
                Lançado em: {ing.createdAt ? new Date(ing.createdAt).toLocaleDateString('pt-AO') : 'N/A'}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Produtos para Venda */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ChefHat size={20}/> Produtos Prontos</h3>
          {canManage && (
            <button 
              onClick={() => {
                if (showAddProd && editingProdId) {
                  setEditingProdId(null);
                  setNewProd({ stock: 0 });
                } else {
                  setShowAddProd(!showAddProd);
                }
              }} 
              className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
            >
              {showAddProd && editingProdId ? 'Cancelar Edição' : 'Novo Produto'}
            </button>
          )}
        </div>
        {showAddProd && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome do Produto</label>
                <input 
                  placeholder="Ex: Pão Francês" 
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.prodName ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newProd.name || ''} 
                  onChange={e => {
                    setNewProd({...newProd, name: e.target.value});
                    if (errors.prodName) setErrors({...errors, prodName: ''});
                  }} 
                />
                {errors.prodName && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.prodName}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Preço (Kz)</label>
                <input 
                  placeholder="Preço" 
                  type="number" 
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.prodPrice ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newProd.price || ''} 
                  onChange={e => {
                    setNewProd({...newProd, price: e.target.value});
                    if (errors.prodPrice) setErrors({...errors, prodPrice: ''});
                  }} 
                />
                {errors.prodPrice && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.prodPrice}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Estoque</label>
                <input 
                  placeholder="Estoque" 
                  type="number" 
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.prodStock ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newProd.stock ?? ''} 
                  onChange={e => {
                    setNewProd({...newProd, stock: e.target.value});
                    if (errors.prodStock) setErrors({...errors, prodStock: ''});
                  }} 
                />
                {errors.prodStock && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.prodStock}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Rendimento da Receita</label>
                <input 
                  placeholder="Ex: 50 (unidades)" 
                  type="number" 
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.prodYield ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newProd.recipeYield || ''} 
                  onChange={e => {
                    setNewProd({...newProd, recipeYield: e.target.value});
                    if (errors.prodYield) setErrors({...errors, prodYield: ''});
                  }} 
                />
                {errors.prodYield && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.prodYield}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Imagem</label>
                <input type="file" accept="image/*" className="text-xs w-full" onChange={handleImageUpload} />
              </div>
              <button onClick={saveProduct} className="bg-amber-600 text-white p-3 rounded-xl font-bold">
                {editingProdId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h4 className="text-sm font-bold text-slate-700 mb-4">Receita (Insumos por Produção)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-bold uppercase">Adicionar Insumo à Receita (Total da Produção)</p>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 p-2 border rounded-lg text-sm"
                      id="recipe-ing-select"
                    >
                      <option value="">Selecionar Insumo...</option>
                      {groupedIngredients.map(group => (
                        <option key={group.representativeId} value={group.representativeId}>
                          {group.name} ({group.unit})
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Qtd" 
                      className="w-24 p-2 border rounded-lg text-sm"
                      id="recipe-amt-input"
                    />
                    <button 
                      onClick={() => {
                        const sel = document.getElementById('recipe-ing-select') as HTMLSelectElement;
                        const amt = document.getElementById('recipe-amt-input') as HTMLInputElement;
                        if (sel.value && amt.value) {
                          addRecipeItem(sel.value, Number(amt.value));
                          amt.value = '';
                        }
                      }}
                      className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-3">Insumos na Receita</p>
                  <div className="space-y-2">
                    {(newProd.recipe || []).map(r => {
                      const ing = ingredients.find(i => i.id === r.ingredientId);
                      return (
                        <div key={r.ingredientId} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg shadow-sm">
                          <span className="font-medium text-slate-700">{ing?.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-amber-600">{r.amount.toFixed(3)} {ing?.unit}</span>
                            <button onClick={() => removeRecipeItem(r.ingredientId)} className="text-red-300 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(newProd.recipe || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhum insumo definido.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(prod => (
            <div key={prod.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group relative">
              {canManage && (
                <button 
                  onClick={() => startEditProduct(prod)}
                  className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-amber-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                  title="Editar Produto"
                >
                  <Settings size={16} />
                </button>
              )}
              <div className="aspect-square bg-slate-50 rounded-2xl mb-4 flex items-center justify-center text-slate-300 group-hover:bg-amber-50 group-hover:text-amber-200 transition-colors overflow-hidden">
                {prod.image ? (
                  <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={48} />
                )}
              </div>
              <h5 className="font-bold text-slate-800">{prod.name}</h5>
              <p className="text-amber-600 font-black text-xl mb-1">{prod.price.toLocaleString()} Kz</p>
              <p className="text-[10px] text-slate-400 mb-2 uppercase font-bold">
                Lançado em: {prod.createdAt ? new Date(prod.createdAt).toLocaleDateString('pt-AO') : 'N/A'}
              </p>
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>ESTOQUE</span>
                <span className={prod.stock < 20 ? 'text-red-500' : 'text-slate-700'}>{prod.stock.toFixed(3)} un.</span>
              </div>
              <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${prod.stock < 20 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(prod.stock, 100)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Calculadora de Produção */}
      <section className="bg-slate-800 p-8 rounded-[40px] text-white shadow-2xl space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 p-3 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Gestão de Produção</h3>
              <p className="text-slate-400 text-sm">Simule produção ou registre estoque inicial.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowInitialStock(!showInitialStock)}
            className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors"
          >
            {showInitialStock ? 'Voltar para Calculadora' : 'Registrar Estoque Inicial'}
          </button>
        </div>

        {showInitialStock ? (
          <div className="bg-slate-700/30 p-8 rounded-3xl border border-slate-700 animate-in fade-in duration-500">
            <h4 className="text-lg font-bold text-amber-500 mb-6">Entrada Manual de Estoque (Estoque Inicial)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Produto</label>
                <select 
                  className="w-full p-4 bg-slate-800 border-none rounded-2xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={initialStockProdId}
                  onChange={e => setInitialStockProdId(e.target.value)}
                >
                  <option value="">Selecionar Produto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Quantidade Inicial</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-800 border-none rounded-2xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={initialStockQty || ''}
                  onChange={e => setInitialStockQty(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <button 
                onClick={registerInitialStock}
                className="bg-green-600 text-white p-4 rounded-2xl font-bold hover:bg-green-500 transition-all shadow-lg shadow-green-900/20"
              >
                Registrar Entrada
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500 italic">
              * Esta operação adiciona estoque diretamente sem consumir insumos da receita. Use para estoque inicial ou ajustes manuais.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Produto a Produzir</label>
                <select 
                  className="w-full p-4 bg-slate-700 border-none rounded-2xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={simProdId}
                  onChange={e => setSimProdId(e.target.value)}
                >
                  <option value="">Selecionar Produto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Quantidade Desejada</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-700 border-none rounded-2xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                  value={simQty}
                  onChange={e => setSimQty(Number(e.target.value))}
                  min="1"
                />
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-700/50 p-6 rounded-3xl border border-slate-700">
              <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-6">Insumos Necessários</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {simProdId ? (() => {
                    const product = products.find(p => p.id === simProdId);
                    if (!product) return null;
                    
                    return product.recipe.map(r => {
                      const recipeIng = ingredients.find(i => i.id === r.ingredientId);
                      if (!recipeIng) return null;
                      
                      const totalAvailable = ingredients
                        .filter(i => i.name.toLowerCase() === recipeIng.name.toLowerCase() && i.unit === recipeIng.unit)
                        .reduce((acc, i) => acc + i.quantity, 0);
                        
                      const totalNeeded = (r.amount / (product.recipeYield || 1)) * simQty;
                      const isShort = totalAvailable < totalNeeded;
                      
                      return (
                        <div key={r.ingredientId} className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                          <div>
                            <p className="text-sm font-bold">{recipeIng.name}</p>
                            <p className="text-[10px] text-slate-500">Total Disponível: {totalAvailable.toFixed(3)} {recipeIng.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-black ${isShort ? 'text-red-400' : 'text-green-400'}`}>
                              {totalNeeded.toFixed(3)} {recipeIng.unit}
                            </p>
                            {isShort && <p className="text-[10px] text-red-400 font-bold uppercase">Falta: {(totalNeeded - totalAvailable).toFixed(3)}</p>}
                          </div>
                        </div>
                      );
                    });
                  })() : (
                  <p className="col-span-full text-center py-10 text-slate-500 italic">Selecione um produto para ver a relação de insumos.</p>
                )}
                {simProdId && products.find(p => p.id === simProdId)?.recipe.length === 0 && (
                  <p className="col-span-full text-center py-10 text-slate-500 italic">Este produto não tem receita definida.</p>
                )}
              </div>
              {simProdId && products.find(p => p.id === simProdId)?.recipe.length > 0 && (
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={produceProduct}
                    className="bg-amber-500 text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-amber-400 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <ChefHat size={20} />
                    Confirmar Produção
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const SalesPOS: React.FC<{
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  sales: Sale[],
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>,
  ingredients: Ingredient[],
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>,
  currentUser: User,
  users: User[],
  hasPermission: (p: string) => boolean,
  companyInfo: CompanyInfo,
  isOnline: boolean
}> = ({ products, setProducts, sales, setSales, currentUser, users, hasPermission, companyInfo, isOnline }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<Sale | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');
  const [authModal, setAuthModal] = useState<{ isOpen: boolean, sale: Sale | null }>({ isOpen: false, sale: null });
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, sale: Sale | null }>({ isOpen: false, sale: null });
  const [discountModal, setDiscountModal] = useState<{
    isOpen: boolean;
    type: 'item' | 'total';
    itemId?: string;
    value: string;
  }>({ isOpen: false, type: 'total', value: '' });
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito'>('Dinheiro');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (activeSubTab === 'pos') {
        // F9 or Enter to complete sale
        if ((e.key === 'F9' || e.key === 'Enter') && cart.length > 0) {
          e.preventDefault();
          completeSale();
        }

        // Esc to clear cart or close receipt
        if (e.key === 'Escape') {
          if (showReceipt) {
            setShowReceipt(null);
          } else if (cart.length > 0) {
            if (confirm('Deseja limpar o carrinho?')) setCart([]);
          }
        }

        // Number keys 1-9 to add products
        if (/^[1-9]$/.test(e.key)) {
          const index = parseInt(e.key) - 1;
          if (products[index]) {
            addToCart(products[index]);
          }
        }
      }

      // Tab switching shortcuts
      if (e.key === 'F2') setActiveSubTab('pos');
      if (e.key === 'F3') setActiveSubTab('history');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, products, activeSubTab, showReceipt]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setNotification({ message: 'Sem estoque!', type: 'error' });
      return;
    }
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, price: product.price }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const completeSale = async () => {
    if (isProcessing) return;
    if (cart.length === 0) {
      setNotification({ message: 'O carrinho está vazio!', type: 'error' });
      return;
    }

    setIsProcessing(true);
    
    try {
      const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const itemDiscounts = cart.reduce((acc, item) => acc + (item.discount || 0), 0);
      const total = subtotal - itemDiscounts - globalDiscount;

      const newSale: Sale = {
        id: Math.random().toString(36).substr(2, 9),
        items: [...cart],
        subtotal,
        discount: itemDiscounts + globalDiscount,
        total: Math.max(0, total),
        timestamp: new Date().toISOString(),
        paymentMethod,
        sellerName: currentUser.username,
        status: 'active'
      };

      // 1. Processar Pagamento (Simulado para Cartão)
      if (paymentMethod.includes('Cartão')) {
        setPaymentStatus('processing');
        // Simulação de delay de processamento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulação de sucesso (95% das vezes)
        if (Math.random() > 0.05) {
          setPaymentStatus('success');
        } else {
          setPaymentStatus('error');
          throw new Error('Pagamento recusado pela operadora do cartão.');
        }
      }

      // 1. Sincronização com Supabase (se online)
      let finalProducts = [...products];
      if (isOnline) {
        // Buscar estoque atualizado do servidor para evitar conflitos
        const productIds = cart.map(i => i.productId);
        const { data: serverProducts, error: fetchError } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', productIds);

        if (fetchError) throw new Error('Erro ao verificar estoque no servidor.');

        // Validar estoque no servidor
        for (const item of cart) {
          const serverProd = serverProducts?.find(sp => sp.id === item.productId);
          if (serverProd && serverProd.stock < item.quantity) {
            throw new Error(`Estoque insuficiente para ${item.productName} no servidor.`);
          }
        }

        // Registrar venda no Supabase
        const snakeSale = toSnakeCase({
          ...newSale,
          items: newSale.items
        });
        const { error: saleError } = await supabase.from('sales').insert([snakeSale]);
        if (saleError) throw saleError;

        // Atualizar estoques no Supabase (em paralelo)
        const productUpdatePromises = cart.map(item => {
          const localProd = products.find(p => p.id === item.productId);
          const serverProd = serverProducts?.find(sp => sp.id === item.productId);
          const currentStock = serverProd ? serverProd.stock : (localProd?.stock || 0);
          const newStock = currentStock - item.quantity;
          
          // Atualizar estado local para refletir o novo estoque calculado com base no servidor
          finalProducts = finalProducts.map(p => p.id === item.productId ? { ...p, stock: newStock } : p);
          
          return supabase.from('products').update({ stock: newStock }).eq('id', item.productId);
        });

        const results = await Promise.all(productUpdatePromises);
        const firstError = results.find(r => r.error)?.error;
        if (firstError) throw firstError;
      } else {
        // Modo Offline: Apenas atualizar estado local
        finalProducts = products.map(p => {
          const cartItem = cart.find(ci => ci.productId === p.id);
          return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
        });
      }

      // 2. Atualizar Estado Local + LocalStorage
      const updatedSales = [...sales, newSale];
      setSales(updatedSales);
      saveToLocal('sales', updatedSales);
      setProducts(finalProducts);
      saveToLocal('products', finalProducts);

      setShowReceipt(newSale);
      setCart([]);
      setGlobalDiscount(0);
      setPaymentMethod('Dinheiro');
      setPaymentStatus('idle');
      setNotification({ message: 'Venda realizada com sucesso!', type: 'success' });
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error);
      setPaymentStatus('error');
      setNotification({ 
        message: `Erro: ${error.message || 'Falha na sincronização.'}`, 
        type: 'error' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const voidSale = async (sale: Sale, authenticated = false, confirmed = false) => {
    if (isProcessing) return;

    if (!confirmed) {
      setConfirmModal({ isOpen: true, sale });
      return;
    }

    if (!authenticated) {
      setAuthModal({ isOpen: true, sale });
      setAuthData({ username: '', password: '' });
      setAuthError('');
      return;
    }

    if (sale.status === 'voided') {
      setNotification({ message: 'Esta venda já foi anulada!', type: 'error' });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Sincronização com Supabase (se online)
      let finalProducts = [...products];
      if (isOnline) {
        // Verificar se a venda já foi anulada no servidor
        const { data: serverSale, error: saleFetchError } = await supabase
          .from('sales')
          .select('status')
          .eq('id', sale.id)
          .single();

        if (saleFetchError) throw new Error('Erro ao verificar status da venda no servidor.');
        if (serverSale?.status === 'voided') {
          throw new Error('Esta venda já foi anulada no servidor.');
        }

        // Buscar estoque atualizado do servidor
        const productIds = sale.items.map(i => i.productId);
        const { data: serverProducts, error: prodFetchError } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', productIds);

        if (prodFetchError) throw new Error('Erro ao buscar estoque atualizado do servidor.');

        // Atualizar status da venda no Supabase
        const { error: saleUpdateError } = await supabase
          .from('sales')
          .update({ status: 'voided' })
          .eq('id', sale.id);

        if (saleUpdateError) throw saleUpdateError;

        // Restaurar estoques no Supabase (em paralelo)
        const productUpdatePromises = sale.items.map(item => {
          const localProd = products.find(p => p.id === item.productId);
          const serverProd = serverProducts?.find(sp => sp.id === item.productId);
          const currentStock = serverProd ? serverProd.stock : (localProd?.stock || 0);
          const newStock = currentStock + item.quantity;

          finalProducts = finalProducts.map(p => p.id === item.productId ? { ...p, stock: newStock } : p);

          return supabase.from('products').update({ stock: newStock }).eq('id', item.productId);
        });

        const results = await Promise.all(productUpdatePromises);
        const firstError = results.find(r => r.error)?.error;
        if (firstError) throw firstError;
      } else {
        // Modo Offline
        finalProducts = products.map(p => {
          const saleItem = sale.items.find(si => si.productId === p.id);
          return saleItem ? { ...p, stock: p.stock + saleItem.quantity } : p;
        });
      }

      // 2. Atualizar Estado Local + LocalStorage
      const updatedSales = sales.map(s => s.id === sale.id ? { ...s, status: 'voided' as const } : s);
      setSales(updatedSales);
      saveToLocal('sales', updatedSales);
      setProducts(finalProducts);
      saveToLocal('products', finalProducts);

      setNotification({ message: 'Venda anulada e estoque restaurado com sucesso!', type: 'success' });
    } catch (error: any) {
      console.error('Erro ao anular venda:', error);
      setNotification({ 
        message: `Erro: ${error.message || 'Falha na sincronização.'}`, 
        type: 'error' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthVoid = () => {
    const admin = users.find(u => u.username === authData.username && u.password === authData.password && u.role === UserRole.ADMIN);
    if (admin) {
      if (authModal.sale) {
        voidSale(authModal.sale, true, true);
        setAuthModal({ isOpen: false, sale: null });
      }
    } else {
      setAuthError('Credenciais de administrador inválidas.');
    }
  };

  const handleApplyDiscount = () => {
    const admin = users.find(u => u.username === authData.username && u.password === authData.password && u.role === UserRole.ADMIN);
    if (!admin) {
      setAuthError('Credenciais de administrador inválidas.');
      return;
    }

    const discountValue = parseFloat(discountModal.value) || 0;
    if (discountValue < 0) {
      setAuthError('O desconto não pode ser negativo.');
      return;
    }

    if (discountModal.type === 'item' && discountModal.itemId) {
      setCart(cart.map(item => {
        if (item.productId === discountModal.itemId) {
          const itemTotal = item.price * item.quantity;
          if (discountValue > itemTotal) {
            setAuthError('Desconto maior que o valor do item.');
            return item;
          }
          return { ...item, discount: discountValue };
        }
        return item;
      }));
    } else if (discountModal.type === 'total') {
      const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const itemDiscounts = cart.reduce((acc, item) => acc + (item.discount || 0), 0);
      if (discountValue > (subtotal - itemDiscounts)) {
        setAuthError('Desconto maior que o total da venda.');
        return;
      }
      setGlobalDiscount(discountValue);
    }

    setDiscountModal({ ...discountModal, isOpen: false });
    setAuthData({ username: '', password: '' });
    setAuthError('');
    setNotification({ message: 'Desconto aplicado com sucesso!', type: 'success' });
  };

  const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalItemDiscounts = cart.reduce((acc, i) => acc + (i.discount || 0), 0);
  const finalTotal = Math.max(0, subtotal - totalItemDiscounts - globalDiscount);

  return (
    <div className="space-y-6 relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-24 right-8 z-[100] p-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? <Save size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-4 no-print">
        <button 
          onClick={() => setActiveSubTab('pos')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'pos' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          Nova Venda (F2)
        </button>
        <button 
          onClick={() => setActiveSubTab('history')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'history' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          Histórico (F3)
        </button>
        <div className="ml-auto flex gap-2">
          <button 
            onClick={() => sales.length > 0 && voidSale(sales[sales.length - 1], currentUser.role === UserRole.ADMIN, false)}
            disabled={sales.length === 0 || sales[sales.length - 1].status === 'voided' || isProcessing}
            className="px-6 py-2 rounded-xl font-bold transition-all bg-white text-red-500 border border-slate-200 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <XCircle size={18} />
            )}
            Anular Última Venda
          </button>
          <button 
            onClick={() => sales.length > 0 && setShowReceipt(sales[sales.length - 1])}
            disabled={sales.length === 0}
            className="px-6 py-2 rounded-xl font-bold transition-all bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Printer size={18} />
            Reimprimir Última Venda
          </button>
        </div>
      </div>

      {activeSubTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
          {/* Product List */}
          <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((prod, idx) => (
                <button 
                  key={prod.id} 
                  onClick={() => addToCart(prod)}
                  className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-left hover:border-amber-500 transition-all hover:-translate-y-1 flex flex-col relative group"
                >
                  {idx < 9 && (
                    <span className="absolute top-2 left-2 bg-slate-800 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx + 1}
                    </span>
                  )}
                  <div className="aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center text-slate-300 overflow-hidden">
                    {prod.image ? (
                      <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={32} />
                    )}
                  </div>
                  <h5 className="font-bold text-slate-800 text-base truncate">{prod.name}</h5>
                  <p className="text-amber-600 font-bold mb-2">{prod.price.toLocaleString()} Kz</p>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase self-start ${prod.stock > 10 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {prod.stock.toFixed(3)} em estoque
                  </span>
                </button>
              ))}
              {products.length === 0 && <p className="col-span-full text-center py-20 text-slate-400">Nenhum produto cadastrado.</p>}
            </div>
          </div>

          {/* Cart Area */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl flex flex-col">
            <div className="p-6 border-b border-slate-50">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><ShoppingCart size={20}/> Carrinho</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm">{item.productName}</p>
                    <p className="text-xs text-slate-500">{item.quantity}x {item.price.toLocaleString()} Kz</p>
                    {item.discount && item.discount > 0 && (
                      <p className="text-[10px] text-green-600 font-bold">- {item.discount.toLocaleString()} Kz (Desconto)</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block">{(item.price * item.quantity - (item.discount || 0)).toLocaleString()} Kz</span>
                      <button 
                        onClick={() => setDiscountModal({ isOpen: true, type: 'item', itemId: item.productId, value: item.discount?.toString() || '' })}
                        className="text-[10px] text-amber-600 hover:underline"
                      >
                        Desconto
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="text-red-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Carrinho vazio</p>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50/50 rounded-b-3xl border-t border-slate-100">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center text-slate-500 text-xs">
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString()} Kz</span>
                </div>
                {(totalItemDiscounts > 0 || globalDiscount > 0) && (
                  <div className="flex justify-between items-center text-green-600 text-xs font-bold">
                    <div className="flex items-center gap-1">
                      <span>Descontos</span>
                      <button 
                        onClick={() => setDiscountModal({ isOpen: true, type: 'total', value: globalDiscount.toString() })}
                        className="text-[10px] hover:underline"
                      >
                        (Editar)
                      </button>
                    </div>
                    <span>- {(totalItemDiscounts + globalDiscount).toLocaleString()} Kz</span>
                  </div>
                )}
                {cart.length > 0 && globalDiscount === 0 && (
                  <button 
                    onClick={() => setDiscountModal({ isOpen: true, type: 'total', value: '' })}
                    className="text-[10px] text-amber-600 hover:underline block"
                  >
                    Aplicar Desconto Total
                  </button>
                )}
                <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-bold uppercase">Total a Pagar</span>
                  <span className="text-2xl font-black text-slate-800">
                    {finalTotal.toLocaleString()} Kz
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="mb-6 space-y-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Método de Pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                        paymentMethod === method 
                          ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' 
                          : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {method === 'Dinheiro' ? <Banknote size={14} className="mx-auto mb-1" /> : <CreditCard size={14} className="mx-auto mb-1" />}
                      {method.split(' ')[0]}
                      {method.includes(' ') && <span className="block opacity-60">{method.split(' ').slice(1).join(' ')}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={completeSale}
                disabled={cart.length === 0 || isProcessing}
                className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center ${
                  paymentStatus === 'error' ? 'bg-red-600 shadow-red-200' : 'bg-amber-600 shadow-amber-200 hover:bg-amber-700'
                }`}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                    <span className="text-[10px] opacity-80">
                      {paymentMethod.includes('Cartão') ? 'Processando Cartão...' : 'Finalizando...'}
                    </span>
                  </div>
                ) : (
                  <span>{paymentStatus === 'error' ? 'Tentar Novamente' : 'Finalizar Compra'}</span>
                )}
                {!isProcessing && <span className="text-[10px] opacity-60 font-normal">Atalho: F9 ou Enter</span>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><History size={20}/> Histórico Completo</h4>
            <span className="text-xs font-bold text-slate-400 uppercase">{sales.length} Vendas Registadas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-6">ID / Data</th>
                  <th className="p-6">Vendedor</th>
                  <th className="p-6">Itens Vendidos</th>
                  <th className="p-6 text-right">Total</th>
                  <th className="p-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {[...sales].reverse().map(sale => (
                  <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors group ${sale.status === 'voided' ? 'opacity-50 grayscale' : ''}`}>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">#{sale.id}</p>
                        {sale.status === 'voided' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[8px] font-black uppercase">Anulada</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{new Date(sale.timestamp).toLocaleString()}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {sale.sellerName?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-700">{sale.sellerName}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        {sale.items.map((item, idx) => (
                          <span key={idx} className="text-xs text-slate-600">
                            {item.quantity}x {item.productName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-slate-800">{sale.total.toLocaleString()} Kz</span>
                        {sale.discount && sale.discount > 0 && (
                          <span className="text-[10px] text-green-600 font-bold">Desc: -{sale.discount.toLocaleString()} Kz</span>
                        )}
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setShowReceipt(sale)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Ver Recibo"
                        >
                          <Printer size={18} />
                        </button>
                        {sale.status !== 'voided' && (
                          <button 
                            onClick={() => voidSale(sale, currentUser.role === UserRole.ADMIN, false)}
                            disabled={isProcessing}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
                            title="Anular Venda"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic">Nenhuma venda registada até ao momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Voiding */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={24} className="text-amber-500" />
                Confirmar Anulação
              </h3>
              <button onClick={() => setConfirmModal({ isOpen: false, sale: null })} className="text-slate-400 hover:text-slate-600">
                <ChevronDown size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                Tem certeza que deseja anular a venda <span className="font-bold text-slate-800">#{confirmModal.sale?.id}</span>?
              </p>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Detalhes da Venda</p>
                <p className="text-sm font-bold text-slate-800">{confirmModal.sale?.total.toLocaleString()} Kz</p>
                <p className="text-[10px] text-slate-500">{confirmModal.sale?.items.length} itens • {confirmModal.sale?.sellerName}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, sale: null })}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (confirmModal.sale) {
                      voidSale(confirmModal.sale, currentUser.role === UserRole.ADMIN, true);
                      setConfirmModal({ isOpen: false, sale: null });
                    }
                  }}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-red-600 shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal for Voiding */}
      {authModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <XCircle size={24} className="text-red-500" />
                Autorização de Anulação
              </h3>
              <button onClick={() => setAuthModal({ isOpen: false, sale: null })} className="text-slate-400 hover:text-slate-600">
                <ChevronDown size={24} />
              </button>
            </div>
            <p className="text-slate-500 text-sm mb-6">
              Esta ação requer privilégios de administrador. Por favor, insira as credenciais.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Utilizador Admin</label>
                <input 
                  type="text"
                  value={authData.username}
                  onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:outline-none focus:border-amber-500"
                  placeholder="Nome de utilizador"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Palavra-passe</label>
                <input 
                  type="password"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:outline-none focus:border-amber-500"
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleAuthVoid()}
                />
              </div>
              {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
              <button 
                onClick={handleAuthVoid}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
              >
                Confirmar Anulação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Wallet size={24} className="text-amber-500" />
                Aplicar Desconto {discountModal.type === 'item' ? 'por Item' : 'Total'}
              </h3>
              <button onClick={() => {
                setDiscountModal({ ...discountModal, isOpen: false });
                setAuthData({ username: '', password: '' });
                setAuthError('');
              }} className="text-slate-400 hover:text-slate-600">
                <ChevronDown size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Valor do Desconto (Kz)</label>
                <input 
                  type="number"
                  value={discountModal.value}
                  onChange={(e) => setDiscountModal({ ...discountModal, value: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:outline-none focus:border-amber-500"
                  placeholder="0"
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">Autorização do Administrador</p>
                <div className="space-y-4">
                  <div>
                    <input 
                      type="text"
                      value={authData.username}
                      onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:outline-none focus:border-amber-500"
                      placeholder="Utilizador Admin"
                    />
                  </div>
                  <div>
                    <input 
                      type="password"
                      value={authData.password}
                      onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl focus:outline-none focus:border-amber-500"
                      placeholder="Palavra-passe"
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                    />
                  </div>
                </div>
              </div>

              {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
              
              <button 
                onClick={handleApplyDiscount}
                className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all"
              >
                Aplicar Desconto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative">
            <div className="p-8">
              <InvoicePrinter 
                customerName="Consumidor Final"
                date={showReceipt.timestamp}
                service={showReceipt.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                amountKz={showReceipt.total}
                subtotal={showReceipt.subtotal}
                discount={showReceipt.discount}
                transactionId={showReceipt.id}
                paymentMethod={showReceipt.paymentMethod}
                companyInfo={companyInfo}
                onClose={() => setShowReceipt(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FinanceManager: React.FC<{
  expenses: Expense[],
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
  sales: Sale[],
  salaryPayments: SalaryPayment[],
  employees: Employee[],
  hasPermission: (p: string) => boolean
}> = ({ expenses, setExpenses, sales, salaryPayments, employees, hasPermission }) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly' | 'all' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [newExp, setNewExp] = useState<Partial<Expense>>({});
  const [showFullSalaryHistory, setShowFullSalaryHistory] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canManage = hasPermission('manage:finance');

  const validateExpense = () => {
    const newErrors: Record<string, string> = {};
    if (!newExp.description || newExp.description.trim().length < 3) newErrors.description = 'Descrição obrigatória (min 3 carac.)';
    if (!newExp.amount || Number(newExp.amount) <= 0) newErrors.amount = 'Valor deve ser maior que zero';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addExpense = async () => {
    if (validateExpense()) {
      const expenseData: Expense = {
        id: Math.random().toString(36).substr(2, 9),
        description: newExp.description!,
        amount: Number(newExp.amount),
        category: newExp.category || 'Outros',
        date: new Date().toISOString()
      };

      const updatedExpenses = [...expenses, expenseData];
      setExpenses(updatedExpenses);
      saveToLocal('expenses', updatedExpenses);

      const snakeData = toSnakeCase(expenseData);
      supabase.from('expenses').insert(snakeData).then(({ error }) => {
        if (error) console.error('Erro ao sincronizar despesa:', error);
      });

      setShowAdd(false);
      setNewExp({});
      setErrors({});
    }
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    const filter = (dateStr: string) => {
      const date = new Date(dateStr);
      if (period === 'all') return true;
      if (period === 'weekly') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        return date >= startOfWeek;
      }
      if (period === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        return date >= startOfMonth;
      }
      if (period === 'yearly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        return date >= startOfYear;
      }
      if (period === 'custom') {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }
      return true;
    };

    return {
      sales: sales.filter(s => s.status !== 'voided' && filter(s.timestamp)),
      expenses: expenses.filter(e => filter(e.date)),
      salaries: salaryPayments.filter(s => filter(s.date))
    };
  }, [sales, expenses, salaryPayments, period, startDate, endDate]);

  const totalSales = filteredData.sales.reduce((acc, s) => acc + s.total, 0);
  
  const salesByMethod = useMemo(() => {
    return filteredData.sales.reduce((acc, s) => {
      const method = s.paymentMethod || 'Dinheiro';
      acc[method] = (acc[method] || 0) + s.total;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredData.sales]);

  const totalSalaries = filteredData.salaries.reduce((acc, s) => acc + s.amount, 0);
  const totalExpenses = filteredData.expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalSales - totalSalaries - totalExpenses;

  const displayedSalaryPayments = showFullSalaryHistory 
    ? [...filteredData.salaries].reverse() 
    : [...filteredData.salaries].reverse().slice(0, 3);

  const getEmployeeName = (id: string) => {
    return employees.find(e => e.id === id)?.name || 'Funcionário Desconhecido';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-amber-600" size={24} /> 
            Gestão Financeira
          </h3>
          <p className="text-slate-500 text-sm">Resumo de receitas, despesas e lucros.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['weekly', 'monthly', 'yearly', 'all', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  period === p 
                    ? 'bg-white text-amber-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'weekly' ? 'Semanal' : p === 'monthly' ? 'Mensal' : p === 'yearly' ? 'Anual' : p === 'custom' ? 'Personalizado' : 'Tudo'}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex gap-2">
              <input 
                type="date"
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-amber-500"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <input 
                type="date"
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-amber-500"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Receita de Vendas</p>
          <h4 className="text-2xl font-bold text-green-600">{totalSales.toLocaleString()} Kz</h4>
          <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
            {Object.entries(salesByMethod).map(([method, amount]) => (
              <div key={method} className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">{method}</span>
                <span className="text-slate-600">{amount.toLocaleString()} Kz</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Folha Salarial</p>
          <h4 className="text-2xl font-bold text-red-600">{totalSalaries.toLocaleString()} Kz</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Custos Operacionais</p>
          <h4 className="text-2xl font-bold text-amber-600">{totalExpenses.toLocaleString()} Kz</h4>
        </div>
        <div className={`p-6 rounded-3xl border shadow-sm ${netProfit >= 0 ? 'bg-slate-800 border-slate-700' : 'bg-red-900 border-red-800'}`}>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Resultado Líquido</p>
          <h4 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-white' : 'text-red-200'}`}>
            {netProfit.toLocaleString()} Kz
          </h4>
          <p className="text-[10px] text-slate-400 mt-2 italic">
            {netProfit >= 0 ? 'Lucro no período' : 'Prejuízo no período'}
          </p>
        </div>
      </div>

      {/* Salary History Section */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 text-red-600 p-2 rounded-xl">
              <Users size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Histórico de Pagamentos de Salários</h3>
          </div>
          {salaryPayments.length > 3 && (
            <button 
              onClick={() => setShowFullSalaryHistory(!showFullSalaryHistory)}
              className="text-amber-600 text-xs font-bold uppercase flex items-center gap-1 hover:underline"
            >
              {showFullSalaryHistory ? (
                <>Ver Menos <ChevronUp size={14}/></>
              ) : (
                <>Ver Histórico Completo <ChevronDown size={14}/></>
              )}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="pb-4">Data</th>
                <th className="pb-4">Funcionário</th>
                <th className="pb-4">Mês Referência</th>
                <th className="pb-4 text-right">Valor Pago</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {displayedSalaryPayments.map(sp => (
                <tr key={sp.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-slate-500">{new Date(sp.date).toLocaleDateString()}</td>
                  <td className="py-4 text-slate-800 font-medium">{getEmployeeName(sp.employeeId)}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold uppercase">{sp.month}</span>
                  </td>
                  <td className="py-4 text-right font-bold text-slate-800">{sp.amount.toLocaleString()} Kz</td>
                </tr>
              ))}
              {salaryPayments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 italic">Nenhum pagamento de salário registado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 text-slate-800 p-2 rounded-xl">
              <Wallet size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Registo de Despesas</h3>
          </div>
          {canManage && (
            <button 
              onClick={() => setShowAdd(!showAdd)}
              className="text-white bg-slate-800 px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              Nova Despesa
            </button>
          )}
        </div>

          {showAdd && (
          <div className="mb-8 p-6 bg-slate-50 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Descrição</label>
              <input 
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-slate-800 outline-none ${errors.description ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newExp.description || ''}
                onChange={e => {
                  setNewExp({...newExp, description: e.target.value});
                  if (errors.description) setErrors({...errors, description: ''});
                }}
                placeholder="Ex: Compra de Lenha"
              />
              {errors.description && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.description}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Valor (Kz)</label>
              <input 
                type="number"
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-slate-800 outline-none ${errors.amount ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newExp.amount || ''}
                onChange={e => {
                  setNewExp({...newExp, amount: e.target.value});
                  if (errors.amount) setErrors({...errors, amount: ''});
                }}
                placeholder="0"
              />
              {errors.amount && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.amount}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
              <select 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 outline-none"
                value={newExp.category || 'Outros'}
                onChange={e => setNewExp({...newExp, category: e.target.value})}
              >
                <option value="Suprimentos">Suprimentos</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Energia">Energia / Água</option>
                <option value="Aluguel">Aluguel</option>
                <option value="Marketing">Marketing</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <button onClick={addExpense} className="bg-slate-800 text-white p-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">Adicionar</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="pb-4">Data</th>
                <th className="pb-4">Descrição</th>
                <th className="pb-4">Categoria</th>
                <th className="pb-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {filteredData.expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="py-4 text-slate-800 font-medium">{exp.description}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">{exp.category}</span>
                  </td>
                  <td className="py-4 text-right font-bold text-slate-800">{exp.amount.toLocaleString()} Kz</td>
                </tr>
              ))}
              {filteredData.expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400">Nenhuma despesa registada no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const UserManager: React.FC<{
  users: User[],
  setUsers: React.Dispatch<React.SetStateAction<User[]>>,
  currentUser: User,
  companyInfo: CompanyInfo,
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>
}> = ({ users, setUsers, currentUser, companyInfo, setCompanyInfo }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.STAFF });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateUser = () => {
    const newErrors: Record<string, string> = {};
    if (!newUser.username || newUser.username.trim().length < 3) newErrors.username = 'Utilizador deve ter pelo menos 3 caracteres';
    
    // Skip password validation if editing an admin (since field is hidden)
    const isEditingAdmin = editingId && newUser.role === UserRole.ADMIN;
    if (!isEditingAdmin) {
      if (!newUser.password || newUser.password.length < 3) newErrors.password = 'Senha deve ter pelo menos 3 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveUser = async () => {
    if (validateUser()) {
      const userData: User = editingId 
        ? { ...users.find(u => u.id === editingId)!, username: newUser.username!, password: newUser.password!, role: newUser.role || UserRole.STAFF }
        : { id: Math.random().toString(36).substr(2, 9), username: newUser.username!, password: newUser.password!, role: newUser.role || UserRole.STAFF };

      // 1. Local
      const updated = editingId 
        ? users.map(u => u.id === editingId ? userData : u)
        : [...users, userData];
      setUsers(updated);
      saveToLocal('users', updated);

      // 2. Background Sync
      const snakeData = toSnakeCase(userData);
      if (editingId) {
        supabase.from('users').update(snakeData).eq('id', editingId).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar utilizador (update):', error);
        });
      } else {
        supabase.from('users').insert(snakeData).then(({ error }) => {
          if (error) console.error('Erro ao sincronizar utilizador (insert):', error);
        });
      }

      setShowAdd(false);
      setEditingId(null);
      setNewUser({ role: UserRole.STAFF });
      setErrors({});
    }
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser.id) {
      alert('Não pode apagar o seu próprio utilizador!');
      return;
    }
    if (confirm('Tem certeza?')) {
      // 1. Local
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      saveToLocal('users', updated);

      // 2. Background Sync
      supabase.from('users').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Erro ao sincronizar exclusão de utilizador:', error);
      });
    }
  };

  const saveCompanyInfo = async () => {
    // 1. Local
    saveToLocal('company_info', companyInfo);
    alert('Informações da empresa atualizadas localmente!');

    // 2. Background Sync
    supabase.from('company_info').upsert(toSnakeCase({ id: 'main', ...companyInfo })).then(({ error }) => {
      if (error) console.error('Erro ao sincronizar informações da empresa:', error);
    });
  };

  const startEdit = (user: User) => {
    setNewUser(user);
    setEditingId(user.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-12">
      {/* Company Info Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-amber-600" size={24} />
            Informações da Empresa (Fatura)
          </h3>
          <button 
            onClick={saveCompanyInfo}
            className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-500 transition-colors flex items-center gap-2"
          >
            <Save size={18} /> Salvar Configurações
          </button>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nome da Empresa</label>
            <input 
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              value={companyInfo.name}
              onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})}
              placeholder="Ex: Madeira Master"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">NIF</label>
            <input 
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              value={companyInfo.nif}
              onChange={e => setCompanyInfo({...companyInfo, nif: e.target.value})}
              placeholder="Ex: 5401234567"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Endereço</label>
            <input 
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              value={companyInfo.address}
              onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})}
              placeholder="Ex: Rua Principal, Luanda, Angola"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Contacto</label>
            <input 
              className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              value={companyInfo.contact}
              onChange={e => setCompanyInfo({...companyInfo, contact: e.target.value})}
              placeholder="Ex: +244 923 000 000"
            />
          </div>
        </div>
      </section>

      {/* User Management Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-amber-600" size={24} />
            Gestão de Utilizadores
          </h3>
          <button 
            onClick={() => { setShowAdd(!showAdd); setEditingId(null); setNewUser({ role: UserRole.STAFF }); }}
            className="bg-slate-800 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-slate-700 transition-colors"
          >
            <Plus size={18}/> Novo Utilizador
          </button>
        </div>

        {showAdd && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nome de Utilizador</label>
              <input 
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.username ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                value={newUser.username || ''}
                onChange={e => {
                  setNewUser({...newUser, username: e.target.value});
                  if (errors.username) setErrors({...errors, username: ''});
                }}
                placeholder="Ex: joao.silva"
              />
              {errors.username && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.username}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Senha</label>
              {editingId && newUser.role === UserRole.ADMIN ? (
                <div className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 font-mono flex items-center h-[46px]">
                  ••••••••
                </div>
              ) : (
                <input 
                  type="password"
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  value={newUser.password || ''}
                  onChange={e => {
                    setNewUser({...newUser, password: e.target.value});
                    if (errors.password) setErrors({...errors, password: ''});
                  }}
                  placeholder="••••••"
                />
              )}
              {errors.password && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.password}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoria (Role)</label>
              <select 
                className="w-full p-3 border rounded-xl"
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
              >
                {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={saveUser} className="flex-1 bg-green-600 text-white p-3 rounded-xl font-bold">
                {editingId ? 'Atualizar' : 'Salvar'}
              </button>
              {editingId && (
                <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="bg-slate-200 text-slate-600 p-3 rounded-xl font-bold">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-6">Utilizador</th>
                <th className="p-6">Categoria</th>
                <th className="p-6 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' :
                      u.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => startEdit(u)}
                        className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const ReportsManager: React.FC<{
  productionLogs: ProductionLog[],
  products: Product[],
  ingredients: Ingredient[],
  companyInfo: CompanyInfo
}> = ({ productionLogs, products, ingredients, companyInfo }) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly' | 'all' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('all');
  const [showDetailed, setShowDetailed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportProductionCSV = () => {
    const headers = ['Data', 'Produto', 'Quantidade', 'Vendedor'];
    const data = filteredLogs.map(log => ({
      'Data': new Date(log.timestamp).toLocaleString(),
      'Produto': log.productName,
      'Quantidade': log.quantity,
      'Vendedor': log.sellerName
    }));
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.Data}"`,
        `"${row.Produto}"`,
        `"${row.Quantidade}"`,
        `"${row.Vendedor}"`
      ].join(','))
    ].join('\n');
    
    downloadCSV(csvContent, `producao_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportIngredientsCSV = () => {
    const headers = ['Insumo', 'Quantidade Usada', 'Unidade'];
    const data = ingredientStats.map(ing => ({
      'Insumo': ing.name,
      'Quantidade Usada': ing.amount.toFixed(3),
      'Unidade': ing.unit
    }));
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.Insumo}"`,
        `"${row['Quantidade Usada']}"`,
        `"${row.Unidade}"`
      ].join(','))
    ].join('\n');
    
    downloadCSV(csvContent, `consumo_insumos_${period}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString('pt-AO');
    const periodLabel = period === 'weekly' ? 'Semanal' : 
                       period === 'monthly' ? 'Mensal' : 
                       period === 'yearly' ? 'Anual' : 
                       period === 'custom' ? `Personalizado (${new Date(startDate).toLocaleDateString('pt-AO')} - ${new Date(endDate).toLocaleDateString('pt-AO')})` : 
                       'Tudo';

    // Header
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11); // amber-600
    doc.text(companyInfo.name.toUpperCase(), 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Relatório de Produção - ' + periodLabel, 14, 30);
    
    let filterText = '';
    if (selectedProductId !== 'all') {
      const prod = products.find(p => p.id === selectedProductId);
      filterText += `Produto: ${prod?.name || selectedProductId} | `;
    }
    if (selectedIngredientId !== 'all') {
      filterText += `Insumo: ${selectedIngredientId} | `;
    }
    
    if (filterText) {
      doc.text('Filtros: ' + filterText.slice(0, -3), 14, 35);
      doc.text('Data de Emissão: ' + dateStr, 14, 40);
    } else {
      doc.text('Data de Emissão: ' + dateStr, 14, 35);
    }
    
    // Summary
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('Resumo do Período', 14, 50);
    
    autoTable(doc, {
      startY: 55,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Produções', filteredLogs.length.toString()],
        ['Total de Itens Produzidos', productStats.reduce((acc, s) => acc + s.quantity, 0).toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] }
    });

    // Top Products
    doc.text('Produtos Fabricados', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Produto', 'Quantidade']],
      body: productStats.map(p => [p.name, p.quantity.toString()]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] }
    });

    // Ingredients
    doc.text('Consumo de Insumos', 14, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Insumo', 'Quantidade', 'Unidade']],
      body: ingredientStats.map(i => [i.name, i.amount.toFixed(3), i.unit]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] }
    });

    // Detailed Logs if requested or just add it anyway
    if (filteredLogs.length > 0) {
      doc.addPage();
      doc.text('Registos Detalhados de Produção', 14, 22);
      autoTable(doc, {
        startY: 30,
        head: [['Data', 'Produto', 'Qtd', 'Vendedor']],
        body: filteredLogs.map(log => [
          new Date(log.timestamp).toLocaleString('pt-AO'),
          log.productName,
          log.quantity.toString(),
          log.sellerName
        ]),
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }
      });
    }

    doc.save(`relatorio_producao_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();

    return productionLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      
      // 1. Date Filtering
      let dateMatch = true;
      if (period === 'weekly') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        dateMatch = logDate >= startOfWeek;
      } else if (period === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        dateMatch = logDate >= startOfMonth;
      } else if (period === 'yearly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        dateMatch = logDate >= startOfYear;
      } else if (period === 'custom') {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = logDate >= start && logDate <= end;
      }

      // 2. Product Filtering
      const productMatch = selectedProductId === 'all' || log.productId === selectedProductId;

      // 3. Ingredient Filtering
      const ingredientMatch = selectedIngredientId === 'all' || 
        log.ingredientsUsed.some(ing => ing.ingredientName.toLowerCase() === selectedIngredientId.toLowerCase());

      return dateMatch && productMatch && ingredientMatch;
    });
  }, [productionLogs, period, startDate, endDate, selectedProductId, selectedIngredientId]);

  const productStats = useMemo(() => {
    const stats: Record<string, { name: string, quantity: number }> = {};
    filteredLogs.forEach(log => {
      if (!stats[log.productId]) {
        stats[log.productId] = { name: log.productName, quantity: 0 };
      }
      stats[log.productId].quantity += log.quantity;
    });
    return Object.values(stats).sort((a, b) => b.quantity - a.quantity);
  }, [filteredLogs]);

  const ingredientStats = useMemo(() => {
    const stats: Record<string, { name: string, amount: number, unit: string }> = {};
    filteredLogs.forEach(log => {
      log.ingredientsUsed.forEach(ing => {
        const key = `${ing.ingredientName.toLowerCase()}-${ing.unit}`;
        if (!stats[key]) {
          stats[key] = { name: ing.ingredientName, amount: 0, unit: ing.unit };
        }
        stats[key].amount += ing.amount;
      });
    });
    return Object.values(stats).sort((a, b) => b.amount - a.amount);
  }, [filteredLogs]);

  const chartData = productStats.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="text-amber-600" size={24} /> 
            Relatórios de Produção
          </h3>
          <p className="text-slate-500 text-sm">Acompanhe o desempenho e o consumo de insumos.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['weekly', 'monthly', 'yearly', 'all', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  period === p 
                    ? 'bg-white text-amber-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'weekly' ? 'Semanal' : p === 'monthly' ? 'Mensal' : p === 'yearly' ? 'Anual' : p === 'custom' ? 'Personalizado' : 'Tudo'}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              showFilters ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Settings size={14} /> Filtros {showFilters ? 'Ativos' : 'Avançados'}
          </button>
          <div className="flex gap-2">
            <button 
              onClick={exportProductionCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              title="Exportar Produção para CSV"
            >
              <Download size={14} /> Produção
            </button>
            <button 
              onClick={exportIngredientsCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              title="Exportar Insumos para CSV"
            >
              <Download size={14} /> Insumos
            </button>
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md active:scale-95"
              title="Exportar Relatório Completo para PDF"
            >
              <FileText size={14} /> Baixar PDF
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
          {period === 'custom' && (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data Inicial</label>
                <input 
                  type="date"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data Final</label>
                <input 
                  type="date"
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
          <div className={period !== 'custom' ? 'md:col-span-2' : ''}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Filtrar por Produto</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
            >
              <option value="all">Todos os Produtos</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className={period !== 'custom' ? 'md:col-span-2' : ''}>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Filtrar por Insumo</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
              value={selectedIngredientId}
              onChange={e => setSelectedIngredientId(e.target.value)}
            >
              <option value="all">Todos os Insumos</option>
              {Array.from(new Set(ingredients.map(i => i.name))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button 
              onClick={() => {
                setPeriod('monthly');
                setSelectedProductId('all');
                setSelectedIngredientId('all');
                setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-amber-600 transition-colors flex items-center gap-1"
            >
              <XCircle size={12} /> Limpar Todos os Filtros
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Products Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ChefHat size={18} className="text-amber-600" /> Top 5 Produtos Produzidos
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="quantity" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-amber-600 p-8 rounded-3xl text-white shadow-lg shadow-amber-100">
            <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
              <Package size={24} />
            </div>
            <p className="text-amber-100 text-xs font-bold uppercase mb-1">Total de Produções</p>
            <h4 className="text-4xl font-black">{filteredLogs.length}</h4>
            <p className="text-amber-100 text-[10px] mt-2 italic">No período selecionado</p>
          </div>
          <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-lg shadow-slate-100">
            <div className="bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
              <ChefHat size={24} />
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Itens Produzidos</p>
            <h4 className="text-4xl font-black">
              {productStats.reduce((acc, s) => acc + s.quantity, 0)}
            </h4>
            <p className="text-slate-400 text-[10px] mt-2 italic">Unidades totais</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ingredients Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-amber-600" /> Consumo de Insumos
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{ingredientStats.length} Insumos Usados</span>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="text-left text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="p-4">Insumo</th>
                  <th className="p-4 text-right">Qtd Usada</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {ingredientStats.map((ing, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">{ing.name}</td>
                    <td className="p-4 text-right font-bold text-amber-600">
                      {ing.amount.toFixed(3)} {ing.unit}
                    </td>
                  </tr>
                ))}
                {ingredientStats.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-12 text-center text-slate-400 italic">Nenhum consumo registrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <ChefHat size={18} className="text-amber-600" /> Produtos Fabricados
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{productStats.length} Tipos de Produtos</span>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="text-left text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="p-4">Produto</th>
                  <th className="p-4 text-right">Qtd Produzida</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {productStats.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">{prod.name}</td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      {prod.quantity} Unidades
                    </td>
                  </tr>
                ))}
                {productStats.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-12 text-center text-slate-400 italic">Nenhuma produção registrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Logs Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <History size={18} className="text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">Registos Detalhados de Produção</h4>
              <p className="text-[10px] text-slate-400 font-medium uppercase">Lista cronológica de todas as produções no período</p>
            </div>
          </div>
          <button 
            onClick={() => setShowDetailed(!showDetailed)}
            className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
          >
            {showDetailed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showDetailed ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </button>
        </div>
        
        {showDetailed && (
          <div className="overflow-x-auto animate-in slide-in-from-top duration-300">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-[10px] uppercase tracking-wider bg-slate-50/30">
                  <th className="p-6">Data / Hora</th>
                  <th className="p-6">Produto</th>
                  <th className="p-6 text-center">Quantidade</th>
                  <th className="p-6">Vendedor</th>
                  <th className="p-6">Insumos Utilizados</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <p className="font-bold text-slate-800">{new Date(log.timestamp).toLocaleDateString('pt-AO')}</p>
                      <p className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString('pt-AO')}</p>
                    </td>
                    <td className="p-6">
                      <span className="font-medium text-slate-700">{log.productName}</span>
                    </td>
                    <td className="p-6 text-center">
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-black">
                        {log.quantity}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {(log.sellerName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-600">{log.sellerName || 'Sistema'}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1">
                        {log.ingredientsUsed.map((ing, iIdx) => (
                          <span key={iIdx} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium">
                            {ing.ingredientName}: {ing.amount.toFixed(3)}{ing.unit}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic">Nenhum registo encontrado para este período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
