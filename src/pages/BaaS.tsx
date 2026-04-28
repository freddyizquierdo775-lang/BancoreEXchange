import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  UserPlus, 
  Wallet, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  MoreVertical,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VIPUser {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  wallet: {
    id: string;
    balances: { [key: string]: number };
  } | null;
  card: {
    id: string;
    cardNumber: string;
    type: string;
    status: string;
  } | null;
  compliance: {
    riskScore: string;
    verified: boolean;
  } | null;
}

export default function BaaS() {
  const [users, setUsers] = useState<VIPUser[]>([]);
  const [totals, setTotals] = useState({ MXN: 0, USD: 0, USDT: 0 });
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showCardModal, setShowCardModal] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/baas/dashboard");
      const data = await res.json();
      if (data.status === "success") {
        setUsers(data.data);
        if (data.totals) setTotals(data.totals);
      }
    } catch (error) {
      console.error("Error fetching BaaS dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleAssignCard = async (userId: string) => {
    if (!cardNumber) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/baas/assign-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cardNumber })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("Tarjeta asignada exitosamente.");
        setShowCardModal(null);
        setCardNumber("");
        fetchDashboard();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error al asignar tarjeta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-white mb-2">
            BaaS <span className="text-binance-yellow font-medium">Ecosystem</span>
          </h1>
          <p className="text-gray-500 text-sm uppercase tracking-widest font-semibold">
            Banking-as-a-Service | Fintech VIP & Private Banking
          </p>
        </div>
        <button 
          onClick={() => setShowRegisterForm(true)}
          className="flex items-center gap-2 bg-binance-yellow text-black px-6 py-3 rounded-xl font-bold hover:bg-binance-yellow/90 transition-all shadow-lg shadow-binance-yellow/10"
        >
          <UserPlus size={20} />
          Alta de Cliente VIP
        </button>
      </div>

      {/* Stats / Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Billeteras Activas" 
          value={users.length.toString()} 
          icon={<Wallet className="text-binance-yellow" />} 
          trend="+12% este mes"
        />
        <StatCard 
          title="Tarjetas Mastercard®" 
          value={users.filter(u => u.card).length.toString()} 
          icon={<CreditCard className="text-emerald-400" />} 
          trend="Rieles TRF Cards Activos"
        />
        <StatCard 
          title="Cumplimiento Normativo" 
          value="98.5%" 
          icon={<ShieldCheck className="text-blue-400" />} 
          trend="Auditoría CNBV OK"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* VIP Clients List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-white">Expedientes de Clientes VIP</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                className="bg-[#1e2329] border border-[#333] rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-binance-yellow"
              />
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center bg-[#1e2329] rounded-2xl border border-[#2b3139]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-binance-yellow"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id}>
                  <VIPUserRow 
                    user={user} 
                    onAssignCard={() => setShowCardModal(user.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Digital Wallets Summary */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Global Liquidity Pool</h2>
          <div className="bg-gradient-to-br from-[#1e2329] to-[#181a20] rounded-3xl border border-[#2b3139] p-6 space-y-6">
            <div className="space-y-4">
              <BalanceItem label="Total MXN Pool" value={`$${totals.MXN.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-white" />
              <BalanceItem label="Total USD Pool" value={`$${totals.USD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-binance-yellow" />
              <BalanceItem label="Total USDT Pool" value={`${totals.USDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`} color="text-emerald-400" />
            </div>
            
            <div className="pt-6 border-t border-[#2b3139]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Últimos Movimientos BaaS</h3>
              <div className="space-y-4">
                <TransactionMini type="IN" label="Fondeo SPEI VIP-001" amount="+ $1,200,000" />
                <TransactionMini type="OUT" label="Gasto Tarjeta VIP-001" amount="- $45,000" />
                <TransactionMini type="IN" label="Swap USD/MXN VIP-002" amount="+ $250,000" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Forms */}
      <AnimatePresence>
        {showRegisterForm && (
          <VIPRegistrationForm 
            onClose={() => setShowRegisterForm(false)} 
            onSuccess={() => {
              setShowRegisterForm(false);
              fetchDashboard();
            }}
          />
        )}

        {showCardModal && (
          <CardAssignmentModal 
            userId={showCardModal}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            onClose={() => setShowCardModal(null)}
            onConfirm={() => handleAssignCard(showCardModal)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string; value: string; icon: React.ReactNode; trend: string }) {
  return (
    <div className="bg-[#1e2329] border border-[#2b3139] p-6 rounded-3xl hover:border-binance-yellow/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-black/20 rounded-2xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{trend}</span>
      </div>
      <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function VIPUserRow({ user, onAssignCard }: { user: VIPUser; onAssignCard: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-2xl hover:bg-[#2b3139]/50 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-lg border border-white/10">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{user.name}</h4>
              <span className="text-[10px] bg-binance-yellow/10 text-binance-yellow px-2 py-0.5 rounded-full font-bold uppercase">VIP</span>
            </div>
            <p className="text-xs text-gray-500">{user.email} • {user.id}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Billetera Principal</p>
            <p className="text-sm font-mono text-white">
              {user.wallet ? `$${user.wallet.balances.MXN.toLocaleString()}` : "Sin Billetera"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Tarjeta Mastercard®</p>
            {user.card ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={14} />
                <span className="text-sm font-mono">{user.card.cardNumber}</span>
              </div>
            ) : (
              <button 
                onClick={onAssignCard}
                className="text-xs text-binance-yellow hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Asignar Tarjeta
              </button>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Compliance</p>
            <div className={`flex items-center gap-1 text-xs ${user.compliance?.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
              {user.compliance?.verified ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
              <span>{user.compliance?.verified ? 'Verificado' : 'Pendiente'}</span>
            </div>
          </div>
        </div>

        <button className="p-2 text-gray-500 hover:text-white">
          <MoreVertical size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function BalanceItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function TransactionMini({ type, label, amount }: { type: 'IN' | 'OUT'; label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {type === 'IN' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span className={`text-xs font-mono font-bold ${type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>{amount}</span>
    </div>
  );
}

function VIPRegistrationForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    initialBalanceMXN: 0,
    estimatedMonthlyAmount: 0,
    estimatedOperations: 0,
    sourceDestinationFunds: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/baas/vip-users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": "admin" // Simulate admin role for this action
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.status === "success") {
        onSuccess();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error al registrar cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-[#1e2329] rounded-[2rem] border border-[#2b3139] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[#2b3139] flex items-center justify-between bg-gradient-to-r from-binance-yellow/5 to-transparent">
          <div>
            <h2 className="text-2xl font-bold text-white">Alta de Cliente VIP</h2>
            <p className="text-gray-500 text-sm">Registro de expediente y cumplimiento normativo</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nombre Completo</label>
              <input 
                required
                type="text" 
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="Ej. Carlos Slim"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email Corporativo</label>
              <input 
                required
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="carlos@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teléfono Directo</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="+52 55..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Saldo Inicial (MXN)</label>
              <input 
                type="number" 
                value={formData.initialBalanceMXN}
                onChange={(e) => setFormData({...formData, initialBalanceMXN: parseFloat(e.target.value)})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Monto Mensual Est.</label>
              <input 
                type="number" 
                value={formData.estimatedMonthlyAmount}
                onChange={(e) => setFormData({...formData, estimatedMonthlyAmount: parseFloat(e.target.value)})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Operaciones Est. / Mes</label>
              <input 
                type="number" 
                value={formData.estimatedOperations}
                onChange={(e) => setFormData({...formData, estimatedOperations: parseInt(e.target.value)})}
                className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Origen / Destino de Fondos</label>
            <input 
              type="text" 
              value={formData.sourceDestinationFunds}
              onChange={(e) => setFormData({...formData, sourceDestinationFunds: e.target.value})}
              className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-binance-yellow"
              placeholder="Ej. Actividad Empresarial"
            />
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex gap-4">
            <ShieldCheck className="text-blue-400 shrink-0" size={24} />
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Al guardar este expediente, se iniciará automáticamente el proceso de debida diligencia (KYC) y se creará una billetera digital multidivisa vinculada a los rieles de Mastercard.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-xl border border-[#333] text-white font-bold hover:bg-[#2b3139] transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 rounded-xl bg-binance-yellow text-black font-bold hover:bg-binance-yellow/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Procesando..." : "Crear Expediente VIP"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function CardAssignmentModal({ 
  userId, 
  cardNumber, 
  setCardNumber, 
  onClose, 
  onConfirm,
  isSubmitting 
}: { 
  userId: string; 
  cardNumber: string; 
  setCardNumber: (v: string) => void; 
  onClose: () => void; 
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-[#1e2329] rounded-[2rem] border border-[#2b3139] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-[#2b3139] bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-4">
            <CreditCard size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">Vincular Tarjeta Física</h2>
          <p className="text-gray-500 text-sm mt-1">Asignación manual de Mastercard® para {userId}</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Número de Tarjeta (16 dígitos)</label>
            <input 
              autoFocus
              type="text" 
              maxLength={16}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-[#181a20] border border-[#333] rounded-xl px-4 py-4 text-xl font-mono tracking-[0.2em] text-white focus:outline-none focus:border-binance-yellow text-center"
              placeholder="0000 0000 0000 0000"
            />
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-4">
            <AlertCircle className="text-amber-400 shrink-0" size={20} />
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Asegúrese de que el número coincida exactamente con la tarjeta física entregada al cliente. Esta acción vinculará los fondos de la billetera digital a este plástico.
            </p>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-xl border border-[#333] text-white font-bold hover:bg-[#2b3139] transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              disabled={cardNumber.length < 16 || isSubmitting}
              className="flex-1 px-6 py-4 rounded-xl bg-binance-yellow text-black font-bold hover:bg-binance-yellow/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Vinculando..." : "Confirmar Vínculo"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
