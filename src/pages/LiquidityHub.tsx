import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  ArrowRight, 
  DollarSign, 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  X,
  Filter,
  BarChart3,
  RefreshCcw,
  Zap
} from 'lucide-react';

interface SettlementItem {
  id: string;
  client_name: string;
  currency_in: string;
  amount_in: number;
  rate: number;
  amount_out: number; // Cost in MXN
  branch_id: string;
  created_at: string;
  marketRates: {
    interbank: number;
    p2p: number;
  };
}

interface AggregatedItem {
  currency: string;
  record_count: number;
  total_amount: number;
  total_cost_mxn: number;
  avg_buy_rate: number;
  marketRates: {
    interbank: number;
    p2p: number;
  };
}

interface PerformanceData {
  month: string;
  totalProfit: number;
  count: number;
  avgSpread: number;
}

export default function LiquidityHub() {
  const [queue, setQueue] = useState<SettlementItem[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'individual' | 'consolidated'>('consolidated');
  
  const [selectedItem, setSelectedItem] = useState<SettlementItem | null>(null);
  const [selectedAggregated, setSelectedAggregated] = useState<AggregatedItem | null>(null);
  
  const [finalPrice, setFinalPrice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [queueRes, perfRes] = await Promise.all([
        fetch('/api/liquidity/queue'),
        fetch('/api/liquidity/performance')
      ]);
      
      const queueData = await queueRes.json();
      const perfData = await perfRes.json();
      
      if (queueData.status === 'success') {
        setQueue(queueData.data.items);
        setAggregated(queueData.data.aggregated);
      }
      if (perfData.status === 'success') setPerformance(perfData.data);
    } catch (error) {
      console.error("Error fetching liquidity data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLiquidate = async () => {
    if ((!selectedItem && !selectedAggregated) || !finalPrice) return;
    
    setIsSubmitting(true);
    try {
      const endpoint = selectedAggregated ? '/api/liquidity/liquidate-general' : '/api/liquidity/liquidate';
      const body = selectedAggregated 
        ? { currency: selectedAggregated.currency, finalPriceSold: parseFloat(finalPrice) }
        : { captacionId: selectedItem?.id, finalPriceSold: parseFloat(finalPrice) };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedItem(null);
        setSelectedAggregated(null);
        setFinalPrice("");
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error al procesar liquidación");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-binance-yellow to-white bg-clip-text text-transparent">
            Centro de Liquidez Global
          </h1>
          <p className="text-gray-400 mt-1">Gestión logística de divisas y re-inyección de capital operativo</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-[#1e2329] p-1 rounded-xl border border-[#2b3139] flex gap-1">
            <button 
              onClick={() => setViewMode('consolidated')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'consolidated' ? 'bg-binance-yellow text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Consolidado
            </button>
            <button 
              onClick={() => setViewMode('individual')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'individual' ? 'bg-binance-yellow text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Individual
            </button>
          </div>
          <button 
            onClick={fetchData}
            className="p-2 bg-[#1e2329] rounded-xl border border-[#2b3139] hover:bg-[#2b3139] transition-colors"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settlement Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="text-binance-yellow" />
              {viewMode === 'consolidated' ? 'Posiciones Generales' : 'Cola de Liquidaciones'}
            </h2>
            <span className="text-xs bg-[#1e2329] px-3 py-1 rounded-full border border-[#2b3139] text-gray-400">
              {viewMode === 'consolidated' ? `${aggregated.length} Divisas` : `${queue.length} Partidas Pendientes`}
            </span>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center p-20">
                <RefreshCcw className="animate-spin text-binance-yellow" size={40} />
              </div>
            ) : viewMode === 'consolidated' ? (
              aggregated.length === 0 ? (
                <EmptyState />
              ) : (
                aggregated.map((item) => (
                  <motion.div 
                    key={item.currency}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 hover:border-binance-yellow/30 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-binance-yellow/10 rounded-2xl flex items-center justify-center text-binance-yellow font-bold text-2xl">
                          {item.currency}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-2xl">{item.total_amount.toLocaleString()} {item.currency}</span>
                            <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              {item.record_count} Operaciones
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-gray-500">
                              Costo Promedio: <span className="text-gray-300 font-medium">${item.avg_buy_rate.toFixed(4)}</span>
                            </span>
                            <span className="text-sm text-gray-500">
                              Costo Total: <span className="text-gray-300 font-medium">${item.total_cost_mxn.toLocaleString()} MXN</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedAggregated(item);
                          setFinalPrice(item.marketRates.p2p.toString());
                        }}
                        className="bg-binance-yellow text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-lg shadow-binance-yellow/10"
                      >
                        Liquidar Posición General
                      </button>
                    </div>
                  </motion.div>
                ))
              )
            ) : (
              queue.length === 0 ? (
                <EmptyState />
              ) : (
                queue.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-5 hover:border-binance-yellow/30 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-binance-yellow/10 rounded-xl flex items-center justify-center text-binance-yellow font-bold text-lg">
                          {item.currency_in}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{item.amount_in.toLocaleString()} {item.currency_in}</span>
                            <ArrowRight size={14} className="text-gray-500" />
                            <span className="text-gray-400 text-sm">Captado @ {item.rate}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Briefcase size={12} /> {item.branch_id}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} /> {new Date(item.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <div className="text-xs text-gray-500 uppercase tracking-wider">Costo Adquisición</div>
                          <div className="font-medium">${item.amount_out.toLocaleString()} MXN</div>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedItem(item);
                            setFinalPrice(item.marketRates.p2p.toString());
                          }}
                          className="bg-[#2b3139] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#363c44] transition-colors flex items-center gap-2 border border-[#333]"
                        >
                          Liquidar Partida
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
            )}
          </div>
        </div>

        {/* Performance & Analytics */}
        <div className="space-y-8">
          {/* Performance Card */}
          <div className="bg-gradient-to-br from-[#1e2329] to-[#0b0e11] border border-[#2b3139] rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp size={120} />
            </div>
            
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="text-binance-yellow" />
              Rendimiento de Mes
            </h2>

            <div className="space-y-6 relative z-10">
              <div>
                <div className="text-gray-500 text-sm mb-1 uppercase tracking-widest">Utilidad Neta Acumulada</div>
                <div className="text-4xl font-bold text-emerald-400">
                  ${performance?.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-lg">MXN</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#181a20] p-4 rounded-2xl border border-[#2b3139]">
                  <div className="text-gray-500 text-xs mb-1">Liquidaciones</div>
                  <div className="text-xl font-bold">{performance?.count}</div>
                </div>
                <div className="bg-[#181a20] p-4 rounded-2xl border border-[#2b3139]">
                  <div className="text-gray-500 text-xs mb-1">Spread Promedio</div>
                  <div className="text-xl font-bold text-binance-yellow">+{performance?.avgSpread.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Vault Status */}
          <div className="bg-[#1e2329] border border-[#2b3139] rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Briefcase size={18} className="text-gray-400" />
              Estado de Bóveda (Virtual)
            </h3>
            <div className="space-y-3">
              <VaultItem currency="MXN" balance={2450000} trend="up" />
              <VaultItem currency="USD" balance={45200} trend="down" />
              <VaultItem currency="USDT" balance={12800} trend="up" />
            </div>
          </div>
        </div>
      </div>

      {/* Liquidation Modal */}
      <AnimatePresence>
        {(selectedItem || selectedAggregated) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedItem(null); setSelectedAggregated(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#1e2329] rounded-[2.5rem] border border-[#2b3139] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[#2b3139] flex items-center justify-between bg-gradient-to-r from-binance-yellow/5 to-transparent">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedAggregated ? `Liquidación General ${selectedAggregated.currency}` : 'Liquidar Partida'}
                  </h2>
                  <p className="text-gray-400 text-sm">Cierre de operación P2P / Interbancario</p>
                </div>
                <button onClick={() => { setSelectedItem(null); setSelectedAggregated(null); }} className="p-2 text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Summary */}
                <div className="bg-[#181a20] rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-xs uppercase">Monto a Liquidar</div>
                    <div className="text-2xl font-bold">
                      {selectedAggregated 
                        ? `${selectedAggregated.total_amount.toLocaleString()} ${selectedAggregated.currency}`
                        : `${selectedItem?.amount_in.toLocaleString()} ${selectedItem?.currency_in}`
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 text-xs uppercase">Costo Promedio</div>
                    <div className="text-lg font-medium text-gray-300">
                      ${selectedAggregated ? selectedAggregated.avg_buy_rate.toFixed(4) : selectedItem?.rate.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Market References */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl">
                    <div className="text-blue-400 text-xs font-bold uppercase mb-1">Interbancario</div>
                    <div className="text-xl font-bold text-blue-100">
                      ${selectedAggregated ? selectedAggregated.marketRates.interbank : selectedItem?.marketRates.interbank}
                    </div>
                    <div className="text-[10px] text-blue-400/60 mt-1">Ref: Redis/Bitacora</div>
                  </div>
                  <div className="bg-binance-yellow/5 border border-binance-yellow/20 p-4 rounded-2xl">
                    <div className="text-binance-yellow text-xs font-bold uppercase mb-1">Cámara P2P</div>
                    <div className="text-xl font-bold text-binance-yellow/90">
                      ${selectedAggregated ? selectedAggregated.marketRates.p2p : selectedItem?.marketRates.p2p}
                    </div>
                    <div className="text-[10px] text-binance-yellow/60 mt-1">Ref: Compensación</div>
                  </div>
                </div>

                {/* Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Precio Final Vendido (MXN)</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</div>
                    <input 
                      type="number" 
                      step="0.0001"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      className="w-full bg-[#181a20] border border-[#333] rounded-2xl pl-8 pr-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-binance-yellow transition-all"
                      placeholder="0.0000"
                    />
                  </div>
                </div>

                {/* Profit Preview */}
                {finalPrice && parseFloat(finalPrice) > 0 && (
                  <div className="flex items-center justify-between px-2">
                    <span className="text-gray-400">Utilidad Proyectada:</span>
                    <span className={`font-bold text-lg ${parseFloat(finalPrice) > (selectedAggregated?.avg_buy_rate || selectedItem?.rate || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${((parseFloat(finalPrice) - (selectedAggregated?.avg_buy_rate || selectedItem?.rate || 0)) * (selectedAggregated?.total_amount || selectedItem?.amount_in || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                )}

                <button 
                  onClick={handleLiquidate}
                  disabled={isSubmitting || !finalPrice}
                  className="w-full bg-binance-yellow text-black py-4 rounded-2xl font-bold text-lg hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-binance-yellow/20"
                >
                  {isSubmitting ? <RefreshCcw className="animate-spin" /> : <CheckCircle size={20} />}
                  Confirmar Liquidación General (FIFO)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[#1e2329] border border-dashed border-[#2b3139] rounded-2xl p-12 text-center">
      <div className="w-16 h-16 bg-[#2b3139] rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-white">Cola Vacía</h3>
      <p className="text-gray-500 max-w-xs mx-auto mt-2">
        No hay divisas captadas pendientes de liquidación en este momento.
      </p>
    </div>
  );
}

function VaultItem({ currency, balance, trend }: { currency: string, balance: number, trend: 'up' | 'down' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#181a20] rounded-xl border border-[#2b3139]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#2b3139] rounded-lg flex items-center justify-center text-xs font-bold">
          {currency}
        </div>
        <span className="font-medium">{balance.toLocaleString()}</span>
      </div>
      <div className={trend === 'up' ? 'text-emerald-400' : 'text-red-400'}>
        {trend === 'up' ? <TrendingUp size={14} /> : <TrendingUp size={14} className="rotate-180" />}
      </div>
    </div>
  );
}
