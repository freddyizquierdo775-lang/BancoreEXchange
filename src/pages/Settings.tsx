import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, Fingerprint, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CurrencyRate {
  code: string;
  name: string;
  buy: number;
  sell: number;
  lastUpdate: string;
}

const INITIAL_RATES: CurrencyRate[] = [
  { code: 'USD', name: 'Dólar Americano', buy: 18.45, sell: 19.55, lastUpdate: '2026-03-01 22:00' },
  { code: 'EUR', name: 'Euro', buy: 20.10, sell: 21.30, lastUpdate: '2026-03-01 22:00' },
  { code: 'GBP', name: 'Libra Esterlina', buy: 23.45, sell: 24.80, lastUpdate: '2026-03-01 22:00' },
  { code: 'CAD', name: 'Dólar Canadiense', buy: 13.60, sell: 14.45, lastUpdate: '2026-03-01 22:00' },
  { code: 'USDT', name: 'Tether (Crypto)', buy: 17.05, sell: 17.10, lastUpdate: '2026-03-01 22:00' },
];

export default function Settings() {
  const [rates, setRates] = useState<CurrencyRate[]>(INITIAL_RATES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch current rates from Redis on mount
  useEffect(() => {
    const fetchCurrentRates = async () => {
      try {
        const res = await fetch("/api/rates/live");
        const data = await res.json();
        if (data.status === "success" && data.rates) {
          const updatedRates = INITIAL_RATES.map(r => {
            const pair = `${r.code}_MXN`;
            if (data.rates[pair]) {
              return {
                ...r,
                buy: data.rates[pair].buy,
                sell: data.rates[pair].sell,
                lastUpdate: data.rates[pair].timestamp
              };
            }
            return r;
          });
          setRates(updatedRates);
        }
      } catch (error) {
        console.error("Error fetching rates in settings:", error);
      }
    };
    fetchCurrentRates();
  }, []);

  const handleRateChange = (code: string, field: 'buy' | 'sell', value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => prev.map(r => r.code === code ? { ...r, [field]: numValue } : r));
  };

  const startValidation = () => {
    setIsModalOpen(true);
    setIsValidating(false);
    setIsSuccess(false);
  };

  const simulateBiometric = async () => {
    setIsValidating(true);
    try {
      // Simulate biometric processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Prepare rates payload for backend
      const ratesPayload: Record<string, { buy: number; sell: number }> = {};
      rates.forEach(r => {
        ratesPayload[r.code] = { buy: r.buy, sell: r.sell };
      });

      // Call backend to update Redis
      const response = await fetch('/api/rates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: ratesPayload })
      });

      if (!response.ok) throw new Error('Failed to update rates');

      setIsValidating(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setIsModalOpen(false);
        alert('Tipos de cambio actualizados correctamente en Redis tras validación biométrica.');
      }, 1500);
    } catch (error) {
      console.error('Error updating rates:', error);
      setIsValidating(false);
      alert('Error al actualizar los tipos de cambio. Intente de nuevo.');
    }
  };

  const addCurrency = () => {
    const code = prompt('Código de la divisa (ej. JPY):')?.toUpperCase();
    if (code && !rates.find(r => r.code === code)) {
      setRates(prev => [...prev, {
        code,
        name: `Nueva Divisa (${code})`,
        buy: 0,
        sell: 0,
        lastUpdate: new Date().toISOString().split('T')[0]
      }]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Configuración</h1>
        <p className="text-gray-400 mt-1">Gestión de parámetros operativos y seguridad de la ventanilla.</p>
      </header>

      <section className="bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="p-6 border-bottom border-[#2b3139] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-binance-yellow/10 rounded-lg">
              <RefreshCw className="text-binance-yellow" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Tipos de Cambio de Ventanilla</h2>
              <p className="text-sm text-gray-400">Establece los precios de compra y venta para divisas físicas.</p>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-black/20 px-3 py-1 rounded-full w-fit">
              <ShieldCheck size={12} className="text-emerald-500" />
              VALIDACIÓN BIOMÉTRICA REQUERIDA
            </div>
            <button 
              onClick={addCurrency}
              className="text-xs text-binance-yellow hover:text-yellow-500 transition-colors font-medium flex items-center gap-1"
            >
              + Agregar Divisa
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {rates.map((rate) => (
              <div key={rate.code} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/20 rounded-lg border border-[#2b3139] gap-4">
                <div className="flex items-center gap-4 min-w-[150px]">
                  <div className="w-10 h-10 rounded-full bg-[#2b3139] flex items-center justify-center font-bold text-white">
                    {rate.code.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{rate.code}</div>
                    <div className="text-xs text-gray-500">{rate.name}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1 max-w-md">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Compra</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.buy}
                        onChange={(e) => handleRateChange(rate.code, 'buy', e.target.value)}
                        className="w-full bg-[#1e2329] border border-[#2b3139] rounded-md py-2 pl-7 pr-3 text-white focus:outline-none focus:border-binance-yellow transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Venta</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.sell}
                        onChange={(e) => handleRateChange(rate.code, 'sell', e.target.value)}
                        className="w-full bg-[#1e2329] border border-[#2b3139] rounded-md py-2 pl-7 pr-3 text-white focus:outline-none focus:border-binance-yellow transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={startValidation}
              className="flex items-center gap-2 px-6 py-3 bg-binance-yellow hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all shadow-lg shadow-yellow-500/10"
            >
              <Save size={18} />
              Guardar Tipos de Cambio
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <AlertCircle className="text-blue-500" size={20} />
          </div>
          <div>
            <h3 className="text-white font-medium">Seguridad Operativa</h3>
            <p className="text-sm text-gray-400 mt-1">
              Todos los cambios en los tipos de cambio son auditados y requieren la presencia física del supervisor autorizado mediante validación biométrica (Huella o Reconocimiento Facial).
            </p>
          </div>
        </div>
      </section>

      {/* Biometric Validation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isValidating && setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1e2329] border border-[#2b3139] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="mb-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 transition-colors ${
                  isSuccess ? 'bg-emerald-500/20 text-emerald-500' : 
                  isValidating ? 'bg-binance-yellow/20 text-binance-yellow animate-pulse' : 
                  'bg-gray-800 text-gray-400'
                }`}>
                  {isSuccess ? <ShieldCheck size={40} /> : <Fingerprint size={40} />}
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {isSuccess ? 'Validación Exitosa' : 'Validación Biométrica'}
                </h3>
                <p className="text-gray-400 mt-2 text-sm">
                  {isSuccess 
                    ? 'Identidad confirmada. Aplicando cambios...' 
                    : 'Por favor, coloque su huella en el lector o mire a la cámara para autorizar el cambio de tasas.'}
                </p>
              </div>

              {!isValidating && !isSuccess && (
                <div className="space-y-3">
                  <button
                    onClick={simulateBiometric}
                    className="w-full py-3 bg-binance-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
                  >
                    Iniciar Escaneo
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {isValidating && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                        className="w-2 h-2 bg-binance-yellow rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Verificando...</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
