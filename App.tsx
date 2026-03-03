
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
  Eye
} from 'lucide-react';
import { 
  User, UserRole, Employee, EmployeeCategory, 
  SalaryPayment, Expense, Ingredient, Product, Sale, SaleItem 
} from './types';
import { getBusinessInsights } from './services/geminiService';
import InvoicePrinter from './src/components/InvoicePrinter';

// --- Default Data ---
const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: '123', role: UserRole.ADMIN },
];

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['dashboard', 'sales', 'inventory', 'hr', 'finance', 'settings'],
  [UserRole.MANAGER]: ['dashboard', 'sales', 'inventory', 'hr', 'finance'],
  [UserRole.STAFF]: ['dashboard', 'sales'],
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
  // App State with LocalStorage Persistence
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('mm_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  const [employees, setEmployees] = useState<Employee[]>(() => JSON.parse(localStorage.getItem('mm_employees') || '[]'));
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>(() => JSON.parse(localStorage.getItem('mm_salaries') || '[]'));
  const [expenses, setExpenses] = useState<Expense[]>(() => JSON.parse(localStorage.getItem('mm_expenses') || '[]'));
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => JSON.parse(localStorage.getItem('mm_ingredients') || '[]'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('mm_products') || '[]'));
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(localStorage.getItem('mm_sales') || '[]'));
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('mm_users', JSON.stringify(users));
    localStorage.setItem('mm_employees', JSON.stringify(employees));
    localStorage.setItem('mm_salaries', JSON.stringify(salaryPayments));
    localStorage.setItem('mm_expenses', JSON.stringify(expenses));
    localStorage.setItem('mm_ingredients', JSON.stringify(ingredients));
    localStorage.setItem('mm_products', JSON.stringify(products));
    localStorage.setItem('mm_sales', JSON.stringify(sales));
  }, [users, employees, salaryPayments, expenses, ingredients, products, sales]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.username === loginData.username && u.password === loginData.password);
    if (foundUser) {
      setUser(foundUser);
      // Reset to first allowed tab
      const allowed = ROLE_PERMISSIONS[foundUser.role];
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0]);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
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
          {ROLE_PERMISSIONS[user.role].includes('dashboard') && <NavItem icon={<PieChart size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />}
          {ROLE_PERMISSIONS[user.role].includes('sales') && <NavItem icon={<ShoppingCart size={20}/>} label="Vendas / POS" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
          {ROLE_PERMISSIONS[user.role].includes('inventory') && <NavItem icon={<Package size={20}/>} label="Estoque & Prod" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />}
          {ROLE_PERMISSIONS[user.role].includes('hr') && <NavItem icon={<Users size={20}/>} label="RH & Salários" active={activeTab === 'hr'} onClick={() => setActiveTab('hr')} />}
          {ROLE_PERMISSIONS[user.role].includes('finance') && <NavItem icon={<Wallet size={20}/>} label="Financeiro" active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} />}
          {ROLE_PERMISSIONS[user.role].includes('settings') && <NavItem icon={<Settings size={20}/>} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
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
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab.replace('inventory', 'Estoque').replace('hr', 'Recursos Humanos').replace('finance', 'Financeiro').replace('settings', 'Configurações')}</h2>
            <p className="text-slate-500 text-sm">Bem-vindo à gestão centralizada da sua padaria.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-400 uppercase">Data Atual</p>
            <p className="text-sm font-medium text-slate-700">{new Date().toLocaleDateString('pt-AO')}</p>
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
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryManager 
            ingredients={ingredients} 
            setIngredients={setIngredients} 
            products={products} 
            setProducts={setProducts} 
          />
        )}
        {activeTab === 'finance' && (
          <FinanceManager 
            expenses={expenses} 
            setExpenses={setExpenses} 
            sales={sales}
            salaryPayments={salaryPayments}
            employees={employees}
          />
        )}
        {activeTab === 'settings' && (
          <UserManager 
            users={users}
            setUsers={setUsers}
            currentUser={user}
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
  const totalRevenue = useMemo(() => sales.reduce((acc, s) => acc + s.total, 0), [sales]);
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
        <Card title="Total de Vendas" value={sales.length.toString()} icon={<ShoppingCart size={24}/>} />
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
                  <tr key={sale.id} className="group">
                    <td className="py-4 text-slate-500">{new Date(sale.timestamp).toLocaleDateString()}</td>
                    <td className="py-4 text-slate-800 font-medium">{sale.items.length} itens</td>
                    <td className="py-4 font-bold text-slate-800">{sale.total.toLocaleString()} Kz</td>
                    <td className="py-4">
                      <span className="px-2 py-1 bg-green-50 text-green-600 rounded-md text-[10px] font-bold uppercase">Concluído</span>
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
  setSalaryPayments: React.Dispatch<React.SetStateAction<SalaryPayment[]>>
}> = ({ employees, setEmployees, salaryPayments, setSalaryPayments }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ category: EmployeeCategory.BAKER });
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'curriculum' | 'idCard') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmp(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveEmployee = () => {
    if (newEmp.name && newEmp.salary) {
      if (editingEmpId) {
        setEmployees(employees.map(emp => emp.id === editingEmpId ? {
          ...emp,
          name: newEmp.name!,
          category: newEmp.category as EmployeeCategory,
          salary: Number(newEmp.salary),
          photo: newEmp.photo,
          curriculum: newEmp.curriculum,
          idCard: newEmp.idCard
        } : emp));
        setEditingEmpId(null);
      } else {
        setEmployees([...employees, {
          id: Math.random().toString(36).substr(2, 9),
          name: newEmp.name,
          category: newEmp.category as EmployeeCategory,
          salary: Number(newEmp.salary),
          hiredDate: new Date().toISOString(),
          photo: newEmp.photo,
          curriculum: newEmp.curriculum,
          idCard: newEmp.idCard
        }]);
      }
      setShowAdd(false);
      setNewEmp({ category: EmployeeCategory.BAKER });
    }
  };

  const startEditEmployee = (emp: Employee) => {
    setNewEmp(emp);
    setEditingEmpId(emp.id);
    setShowAdd(true);
  };

  const deleteEmployee = (id: string) => {
    if (confirm('Tem certeza?')) setEmployees(employees.filter(e => e.id !== id));
  };

  const paySalary = (emp: Employee) => {
    const payment: SalaryPayment = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: emp.id,
      amount: emp.salary,
      date: new Date().toISOString(),
      month: new Date().toLocaleString('pt-BR', { month: 'long' })
    };
    setSalaryPayments([...salaryPayments, payment]);
    alert(`Salário de ${emp.name} pago com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Gestão de Staff</h3>
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
      </div>

      {showAdd && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nome Completo</label>
              <input 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                value={newEmp.name || ''}
                onChange={e => setNewEmp({...newEmp, name: e.target.value})}
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
              <select 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
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
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                value={newEmp.salary || ''}
                onChange={e => setNewEmp({...newEmp, salary: e.target.value})}
                placeholder="0"
              />
            </div>
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
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">{emp.category}</span>
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
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Salário Mensal</p>
                  <p className="font-bold text-slate-800 text-lg">{emp.salary.toLocaleString()} Kz</p>
                </div>
                <button 
                  onClick={() => paySalary(emp)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-100"
                >
                  Pagar Agora
                </button>
              </div>
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="col-span-full text-center py-20 text-slate-400">Nenhum funcionário cadastrado.</p>}
      </div>
    </div>
  );
};

const InventoryManager: React.FC<{
  ingredients: Ingredient[],
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>,
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>
}> = ({ ingredients, setIngredients, products, setProducts }) => {
  const [showAddIng, setShowAddIng] = useState(false);
  const [newIng, setNewIng] = useState<Partial<Ingredient>>({ unit: 'kg' });
  const [showAddProd, setShowAddProd] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>({ stock: 0 });
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [simProdId, setSimProdId] = useState<string>('');
  const [simQty, setSimQty] = useState<number>(1);
  const [showInitialStock, setShowInitialStock] = useState(false);
  const [initialStockProdId, setInitialStockProdId] = useState<string>('');
  const [initialStockQty, setInitialStockQty] = useState<number>(0);

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

  const registerInitialStock = () => {
    if (!initialStockProdId || initialStockQty <= 0) {
      alert('Selecione um produto e uma quantidade válida!');
      return;
    }
    const product = products.find(p => p.id === initialStockProdId);
    if (!product) return;

    const updatedProducts = products.map(p => {
      if (p.id === initialStockProdId) {
        return { ...p, stock: p.stock + initialStockQty };
      }
      return p;
    });

    setProducts(updatedProducts);
    alert(`Estoque inicial de ${initialStockQty}x ${product.name} registrado com sucesso!`);
    setInitialStockProdId('');
    setInitialStockQty(0);
    setShowInitialStock(false);
  };

  const produceProduct = () => {
    if (!simProdId) return;
    const product = products.find(p => p.id === simProdId);
    if (!product) return;

    // Check if enough ingredients (by name)
    const canProduce = product.recipe.every(r => {
      const recipeIng = ingredients.find(i => i.id === r.ingredientId);
      if (!recipeIng) return false;
      
      const totalAvailable = ingredients
        .filter(i => i.name.toLowerCase() === recipeIng.name.toLowerCase() && i.unit === recipeIng.unit)
        .reduce((acc, i) => acc + i.quantity, 0);
        
      return totalAvailable >= (r.amount * simQty);
    });

    if (!canProduce) {
      alert('Insumos insuficientes para esta produção!');
      return;
    }

    // Deduct ingredients (FIFO - First In First Out)
    let tempIngredients = [...ingredients];
    product.recipe.forEach(r => {
      const recipeIng = ingredients.find(i => i.id === r.ingredientId);
      if (!recipeIng) return;
      
      let amountToDeduct = r.amount * simQty;
      
      // Sort by date if possible, otherwise just use order
      tempIngredients = tempIngredients.map(ing => {
        if (ing.name.toLowerCase() === recipeIng.name.toLowerCase() && ing.unit === recipeIng.unit && amountToDeduct > 0) {
          const deduction = Math.min(ing.quantity, amountToDeduct);
          amountToDeduct -= deduction;
          return { ...ing, quantity: ing.quantity - deduction };
        }
        return ing;
      });
    });

    // Increase product stock
    const updatedProducts = products.map(p => {
      if (p.id === simProdId) {
        return { ...p, stock: p.stock + simQty };
      }
      return p;
    });

    setIngredients(tempIngredients);
    setProducts(updatedProducts);
    alert(`Produção de ${simQty}x ${product.name} concluída com sucesso!`);
  };

  const saveIngredient = () => {
    if (newIng.name && newIng.quantity) {
      if (editingIngId) {
        setIngredients(ingredients.map(ing => ing.id === editingIngId ? {
          ...ing,
          name: newIng.name!,
          unit: newIng.unit || 'kg',
          quantity: Number(newIng.quantity),
          costPerUnit: Number(newIng.costPerUnit || 0)
        } : ing));
        setEditingIngId(null);
      } else {
        setIngredients([...ingredients, {
          id: Math.random().toString(36).substr(2, 9),
          name: newIng.name,
          unit: newIng.unit || 'kg',
          quantity: Number(newIng.quantity),
          costPerUnit: Number(newIng.costPerUnit || 0),
          createdAt: new Date().toISOString()
        }]);
      }
      setShowAddIng(false);
      setNewIng({ unit: 'kg' });
    }
  };

  const startEditIngredient = (ing: Ingredient) => {
    setNewIng(ing);
    setEditingIngId(ing.id);
    setShowAddIng(true);
  };

  const saveProduct = () => {
    if (newProd.name && newProd.price) {
      const recipe = newProd.recipe || [];
      if (editingProdId) {
        setProducts(products.map(p => p.id === editingProdId ? {
          ...p,
          name: newProd.name!,
          price: Number(newProd.price),
          stock: Number(newProd.stock),
          image: newProd.image,
          recipe: recipe
        } : p));
        setEditingProdId(null);
      } else {
        setProducts([...products, {
          id: Math.random().toString(36).substr(2, 9),
          name: newProd.name,
          price: Number(newProd.price),
          stock: Number(newProd.stock),
          image: newProd.image,
          createdAt: new Date().toISOString(),
          recipe: recipe
        }]);
      }
      setShowAddProd(false);
      setNewProd({ stock: 0, recipe: [] });
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
      reader.onloadend = () => {
        setNewProd({ ...newProd, image: reader.result as string });
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
              <p className="text-xl font-black text-slate-800">{group.total} <span className="text-sm font-normal text-slate-500">{group.unit}</span></p>
            </div>
          ))}
          {groupedIngredients.length === 0 && <p className="col-span-full text-center py-4 text-amber-600/50 italic text-sm">Nenhum insumo para totalizar.</p>}
        </div>
      </section>

      {/* Insumos */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Package size={20}/> Matéria Prima (Insumos)</h3>
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
        </div>
        {showAddIng && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome do Insumo</label>
              <input placeholder="Ex: Farinha" className="w-full p-3 border rounded-xl" value={newIng.name || ''} onChange={e => setNewIng({...newIng, name: e.target.value})} />
              {newIng.name && groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase()) && (
                <p className="text-[10px] text-amber-600 font-bold mt-1 animate-pulse">
                  Total atual em estoque: {groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase())?.total} {groupedIngredients.find(g => g.name.toLowerCase() === newIng.name?.toLowerCase())?.unit}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Quantidade</label>
              <input placeholder="Qtd" type="number" className="w-full p-3 border rounded-xl" value={newIng.quantity || ''} onChange={e => setNewIng({...newIng, quantity: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidade</label>
              <select className="w-full p-3 border rounded-xl" value={newIng.unit} onChange={e => setNewIng({...newIng, unit: e.target.value})}>
                <option value="kg">Quilos (kg)</option>
                <option value="L">Litros (L)</option>
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
              <button 
                onClick={() => startEditIngredient(ing)}
                className="absolute top-4 right-4 p-1.5 bg-slate-50 text-slate-400 hover:text-amber-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Editar Insumo"
              >
                <Settings size={14} />
              </button>
              <h5 className="font-bold text-slate-800 mb-1">{ing.name}</h5>
              <div className="flex justify-between items-center mb-2">
                <p className="text-lg font-bold text-amber-600">{ing.quantity} {ing.unit}</p>
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
        </div>
        {showAddProd && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome do Produto</label>
                <input placeholder="Ex: Pão Francês" className="w-full p-3 border rounded-xl" value={newProd.name || ''} onChange={e => setNewProd({...newProd, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Preço (Kz)</label>
                <input placeholder="Preço" type="number" className="w-full p-3 border rounded-xl" value={newProd.price || ''} onChange={e => setNewProd({...newProd, price: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Estoque</label>
                <input placeholder="Estoque" type="number" className="w-full p-3 border rounded-xl" value={newProd.stock ?? ''} onChange={e => setNewProd({...newProd, stock: e.target.value})} />
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
              <h4 className="text-sm font-bold text-slate-700 mb-4">Receita (Insumos por Unidade)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-bold uppercase">Adicionar Insumo à Receita</p>
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
                            <span className="font-bold text-amber-600">{r.amount} {ing?.unit}</span>
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
              <button 
                onClick={() => startEditProduct(prod)}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-amber-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                title="Editar Produto"
              >
                <Settings size={16} />
              </button>
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
                <span className={prod.stock < 20 ? 'text-red-500' : 'text-slate-700'}>{prod.stock} un.</span>
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
                {simProdId ? (
                  products.find(p => p.id === simProdId)?.recipe.map(r => {
                    const recipeIng = ingredients.find(i => i.id === r.ingredientId);
                    if (!recipeIng) return null;
                    
                    const totalAvailable = ingredients
                      .filter(i => i.name.toLowerCase() === recipeIng.name.toLowerCase() && i.unit === recipeIng.unit)
                      .reduce((acc, i) => acc + i.quantity, 0);
                      
                    const totalNeeded = r.amount * simQty;
                    const isShort = totalAvailable < totalNeeded;
                    
                    return (
                      <div key={r.ingredientId} className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div>
                          <p className="text-sm font-bold">{recipeIng.name}</p>
                          <p className="text-[10px] text-slate-500">Total Disponível: {totalAvailable} {recipeIng.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black ${isShort ? 'text-red-400' : 'text-green-400'}`}>
                            {totalNeeded} {recipeIng.unit}
                          </p>
                          {isShort && <p className="text-[10px] text-red-400 font-bold uppercase">Falta: {totalNeeded - totalAvailable}</p>}
                        </div>
                      </div>
                    );
                  })
                ) : (
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
  currentUser: User
}> = ({ products, setProducts, sales, setSales, currentUser }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<Sale | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Sem estoque!');
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

  const completeSale = () => {
    if (cart.length === 0) return;
    
    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      items: [...cart],
      total,
      timestamp: new Date().toISOString(),
      paymentMethod: 'Dinheiro',
      sellerName: currentUser.username
    };

    // Update stock
    setProducts(products.map(p => {
      const cartItem = cart.find(ci => ci.productId === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
    }));

    setSales([...sales, newSale]);
    setShowReceipt(newSale);
    setCart([]);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-4 no-print">
        <button 
          onClick={() => setActiveSubTab('pos')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'pos' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          Nova Venda (POS)
        </button>
        <button 
          onClick={() => setActiveSubTab('history')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSubTab === 'history' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          Histórico de Vendas
        </button>
      </div>

      {activeSubTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
          {/* Product List */}
          <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map(prod => (
                <button 
                  key={prod.id} 
                  onClick={() => addToCart(prod)}
                  className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-left hover:border-amber-500 transition-all hover:-translate-y-1 flex flex-col"
                >
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
                    {prod.stock} em estoque
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
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">{(item.price * item.quantity).toLocaleString()} Kz</span>
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
              <div className="flex justify-between items-end mb-6">
                <span className="text-slate-400 text-xs font-bold uppercase">Total a Pagar</span>
                <span className="text-2xl font-black text-slate-800">
                  {cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()} Kz
                </span>
              </div>
              <button 
                onClick={completeSale}
                disabled={cart.length === 0}
                className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50"
              >
                Finalizar Compra
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
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <p className="font-bold text-slate-800">#{sale.id}</p>
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
                    <td className="p-6 text-right font-black text-slate-800">
                      {sale.total.toLocaleString()} Kz
                    </td>
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => setShowReceipt(sale)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Ver Recibo"
                      >
                        <Printer size={18} />
                      </button>
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

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative no-print">
            <div className="p-8">
              <InvoicePrinter 
                customerName="Consumidor Final"
                date={showReceipt.timestamp}
                service={showReceipt.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                amountKz={showReceipt.total}
                transactionId={showReceipt.id}
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
  employees: Employee[]
}> = ({ expenses, setExpenses, sales, salaryPayments, employees }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newExp, setNewExp] = useState<Partial<Expense>>({});
  const [showFullSalaryHistory, setShowFullSalaryHistory] = useState(false);

  const addExpense = () => {
    if (newExp.description && newExp.amount) {
      setExpenses([...expenses, {
        id: Math.random().toString(36).substr(2, 9),
        description: newExp.description,
        amount: Number(newExp.amount),
        category: newExp.category || 'Outros',
        date: new Date().toISOString()
      }]);
      setShowAdd(false);
    }
  };

  const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
  const totalSalaries = salaryPayments.reduce((acc, s) => acc + s.amount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const displayedSalaryPayments = showFullSalaryHistory 
    ? [...salaryPayments].reverse() 
    : [...salaryPayments].reverse().slice(0, 3);

  const getEmployeeName = (id: string) => {
    return employees.find(e => e.id === id)?.name || 'Funcionário Desconhecido';
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Receita de Vendas</p>
          <h4 className="text-2xl font-bold text-green-600">{totalSales.toLocaleString()} Kz</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Folha Salarial</p>
          <h4 className="text-2xl font-bold text-red-600">{totalSalaries.toLocaleString()} Kz</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Custos Operacionais</p>
          <h4 className="text-2xl font-bold text-amber-600">{totalExpenses.toLocaleString()} Kz</h4>
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
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="text-white bg-slate-800 px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
          >
            Nova Despesa
          </button>
        </div>

        {showAdd && (
          <div className="mb-8 p-6 bg-slate-50 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Descrição</label>
              <input 
                className="w-full p-3 border rounded-xl"
                onChange={e => setNewExp({...newExp, description: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Valor (Kz)</label>
              <input 
                type="number"
                className="w-full p-3 border rounded-xl"
                onChange={e => setNewExp({...newExp, amount: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
              <select 
                className="w-full p-3 border rounded-xl"
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
            <button onClick={addExpense} className="bg-slate-800 text-white p-3 rounded-xl font-bold">Adicionar</button>
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
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="py-4 text-slate-800 font-medium">{exp.description}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">{exp.category}</span>
                  </td>
                  <td className="py-4 text-right font-bold text-slate-800">{exp.amount.toLocaleString()} Kz</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400">Nenhuma despesa registada.</td>
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
  currentUser: User
}> = ({ users, setUsers, currentUser }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.STAFF });
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveUser = () => {
    if (newUser.username && newUser.password) {
      if (editingId) {
        setUsers(users.map(u => u.id === editingId ? { ...u, ...newUser } as User : u));
        setEditingId(null);
      } else {
        setUsers([...users, {
          id: Math.random().toString(36).substr(2, 9),
          username: newUser.username,
          password: newUser.password,
          role: newUser.role || UserRole.STAFF
        }]);
      }
      setShowAdd(false);
      setNewUser({ role: UserRole.STAFF });
    }
  };

  const deleteUser = (id: string) => {
    if (id === currentUser.id) {
      alert('Não pode apagar o seu próprio utilizador!');
      return;
    }
    if (confirm('Tem certeza?')) setUsers(users.filter(u => u.id !== id));
  };

  const startEdit = (user: User) => {
    setNewUser(user);
    setEditingId(user.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Gestão de Utilizadores</h3>
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
              className="w-full p-3 border rounded-xl"
              value={newUser.username || ''}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Senha</label>
            <input 
              type="password"
              className="w-full p-3 border rounded-xl"
              value={newUser.password || ''}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
            />
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
    </div>
  );
};

export default App;
