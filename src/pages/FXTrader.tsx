import { useState, useEffect, useMemo, FormEvent } from "react";
import { 
  User, 
  ArrowLeftRight, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  Receipt, 
  Calculator,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Coins,
  Search,
  UserPlus,
  Info,
  ShieldCheck,
  X,
  Clock,
  Upload,
  FileText,
  Plus,
  Minus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Rate {
  buy: number;
  sell: number;
  timestamp: string;
}

interface RatesResponse {
  status: string;
  rates: Record<string, Rate>;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

interface Customer {
  id: string;
  full_name: string;
  risk_level: string;
  email?: string;
  phone?: string;
  isVIP?: boolean;
  walletBalance?: {
    MXN: number;
    USD: number;
    USDT: number;
  };
}

interface TransferDetails {
  bankName: string;
  accountNumber: string;
  holderName: string;
  date: string;
  trackingId: string;
  txid: string;
}

const initialTransferDetails: TransferDetails = {
  bankName: "",
  accountNumber: "",
  holderName: "",
  date: new Date().toISOString().split('T')[0],
  trackingId: "",
  txid: ""
};

const CURRENCIES: Currency[] = [
  { code: "MXN", name: "Peso Mexicano", symbol: "$", flag: "🇲🇽" },
  { code: "USD", name: "Dólar Americano", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "Libra Esterlina", symbol: "£", flag: "🇬🇧" },
  { code: "CAD", name: "Dólar Canadiense", symbol: "$", flag: "🇨🇦" },
  { code: "USDT", name: "Tether (Crypto)", symbol: "₮", flag: "🟢" },
];

export default function FXTrader() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [currencyIn, setCurrencyIn] = useState<Currency>(CURRENCIES.find(c => c.code === "USD") || CURRENCIES[1]);
  const [currencyOut, setCurrencyOut] = useState<Currency>(CURRENCIES.find(c => c.code === "MXN") || CURRENCIES[0]);
  const [methodIn, setMethodIn] = useState<"CASH" | "TRANSFER">("CASH");
  const [methodOut, setMethodOut] = useState<"CASH" | "TRANSFER">("CASH");
  const [amountIn, setAmountIn] = useState<string>("");
  
  const [markup, setMarkup] = useState(0);
  const [liveRates, setLiveRates] = useState<Record<string, Rate>>({});
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState<any>(null);

  // BaaS / VIP States
  const [baasMode, setBaasMode] = useState<"NONE" | "ON_RAMP" | "OFF_RAMP">("NONE");

  // Symmetric Transfer States
  const [incomingTransferDetails, setIncomingTransferDetails] = useState<TransferDetails>(initialTransferDetails);
  const [incomingFile, setIncomingFile] = useState<File | null>(null);
  
  const [outgoingTransferDetails, setOutgoingTransferDetails] = useState<TransferDetails>(initialTransferDetails);
  const [outgoingFile, setOutgoingFile] = useState<File | null>(null);

  // Denominations States
  const [denominationsIn, setDenominationsIn] = useState<Record<number, number>>({});
  const [denominationsOut, setDenominationsOut] = useState<Record<number, number>>({});
  const [denomsConfig, setDenomsConfig] = useState<Record<string, any[]>>({});
  const [showDenomsModal, setShowDenomsModal] = useState<"IN" | "OUT" | null>(null);

  // Customer Search Logic (Debounce)
  useEffect(() => {
    if (customerSearch.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/kyc/search?q=${encodeURIComponent(customerSearch)}`);
        const data = await res.json();
        if (data.status === "success") {
          setSearchResults(data.data);
        }
      } catch (error) {
        console.error("Error searching customers:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Cross-Currency Calculation Logic
  const calculation = useMemo(() => {
    if (!currencyIn || !currencyOut) return { rate: 0, amountOut: 0, markupAmount: 0, finalTotal: 0 };
    
    const rateInData = liveRates[`${currencyIn.code}_MXN`];
    const rateOutData = liveRates[`${currencyOut.code}_MXN`];
    
    if (!rateInData || !rateOutData) return { rate: 0, amountOut: 0, markupAmount: 0, finalTotal: 0 };

    const rateIn = rateInData.buy;
    const rateOut = rateOutData.sell;
    const crossRate = rateIn / rateOut;

    const numAmountIn = parseFloat(amountIn) || 0;
    const baseAmountOut = numAmountIn * crossRate;
    const markupAmount = baseAmountOut * (markup / 100);
    let finalAmountOut = baseAmountOut - markupAmount;

    // Smart Rounding for Cash to avoid unbreakable cent differences
    if (methodOut === "CASH") {
      // Round to nearest 0.50 if currency is MXN, otherwise to nearest integer or appropriate step
      const step = currencyOut.code === 'MXN' ? 0.5 : 1;
      finalAmountOut = Math.round(finalAmountOut / step) * step;
    } else {
      finalAmountOut = Math.round(finalAmountOut * 100) / 100;
    }

    return {
      rate: crossRate,
      amountOut: baseAmountOut,
      markupAmount,
      finalTotal: finalAmountOut
    };
  }, [currencyIn, currencyOut, liveRates, amountIn, markup, methodOut]);

  // Helper to calculate total for a breakdown state
  const calculateDenomsTotal = (breakdown: Record<number, number>) => {
    return Math.round(Object.entries(breakdown).reduce((sum, [val, qty]) => sum + (parseFloat(val) * qty), 0) * 100) / 100;
  };

  const isDenomsInValid = useMemo(() => {
    if (methodIn !== "CASH") return true;
    const val = parseFloat(amountIn) || 0;
    if (val <= 0) return true;
    const total = calculateDenomsTotal(denominationsIn);
    return Math.abs(total - val) < 0.01;
  }, [methodIn, denominationsIn, amountIn]);

  const isDenomsOutValid = useMemo(() => {
    if (methodOut !== "CASH") return true;
    if (calculation.finalTotal <= 0) return true;
    const total = calculateDenomsTotal(denominationsOut);
    return Math.abs(total - calculation.finalTotal) < 0.01;
  }, [methodOut, denominationsOut, calculation.finalTotal]);

  // Automatic Triggers: Open modal when amount is entered or currency changed
  useEffect(() => {
    const val = parseFloat(amountIn) || 0;
    if (methodIn === "CASH" && val > 0 && !isDenomsInValid && !showDenomsModal) {
      const timer = setTimeout(() => setShowDenomsModal("IN"), 500);
      return () => clearTimeout(timer);
    }
  }, [amountIn, methodIn, isDenomsInValid, showDenomsModal]);

  useEffect(() => {
    if (methodOut === "CASH" && calculation.finalTotal > 0 && !isDenomsOutValid && !showDenomsModal) {
      const timer = setTimeout(() => setShowDenomsModal("OUT"), 1500);
      return () => clearTimeout(timer);
    }
  }, [calculation.finalTotal, methodOut, isDenomsOutValid, showDenomsModal]);

  // Fetch denominations for active currencies
  useEffect(() => {
    const fetchDenoms = async (currency: string) => {
      if (denomsConfig[currency]) return;
      try {
        const res = await fetch(`/api/config/denominations/${currency}`);
        const data = await res.json();
        if (data.status === "success") {
          setDenomsConfig(prev => ({ ...prev, [currency]: data.data }));
        }
      } catch (e) {
        console.error("Error fetching denoms", e);
      }
    };

    fetchDenoms(currencyIn.code);
    fetchDenoms(currencyOut.code);
  }, [currencyIn.code, currencyOut.code]);

  // Fetch live rates and config
  useEffect(() => {
    console.log("FXTrader fetching data...");
    const fetchData = async () => {
      try {
        const [ratesRes, configRes] = await Promise.all([
          fetch("/api/rates/live"),
          fetch("/api/config/fx")
        ]);
        
        const ratesData: RatesResponse = await ratesRes.json();
        if (ratesData.status === "success" && ratesData.rates) {
          setLiveRates(ratesData.rates);
        }

        const configData = await configRes.json();
        if (configData.status === "success") {
          setMarkup(configData.config.transactionalPercentage);
        }
        
        setIsLoadingRates(false);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseOperation = async () => {
    if (!selectedCustomer || !currencyIn || !currencyOut || !amountIn || parseFloat(amountIn) <= 0) {
      alert("Por favor seleccione un cliente y complete todos los campos correctamente.");
      return;
    }

    if (methodOut === 'TRANSFER' && !outgoingTransferDetails.bankName && !outgoingTransferDetails.txid) {
      alert("Por favor ingrese los datos de destino para la transferencia.");
      return;
    }

    // Strict Validation: Denominations must match if CASH
    if (methodIn === "CASH" && !isDenomsInValid) {
      alert("El desglose de billetes recibidos no coincide con el monto total.");
      return;
    }
    if (methodOut === "CASH" && !isDenomsOutValid) {
      alert("El desglose de billetes a entregar no coincide con el monto total.");
      return;
    }

    setIsProcessing(true);
    
    // Detailed denomination data for vault update
    const denomsInArray = Object.entries(denominationsIn)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([val, qty]) => ({ denominacion: parseFloat(val), quantity: qty as number }));
    const denomsOutArray = Object.entries(denominationsOut)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([val, qty]) => ({ denominacion: parseFloat(val), quantity: qty as number }));

    const formData = new FormData();
    formData.append("clientName", selectedCustomer.full_name);
    formData.append("customerId", selectedCustomer.id);
    formData.append("currencyIn", currencyIn.code);
    formData.append("methodIn", methodIn);
    formData.append("currencyOut", currencyOut.code);
    formData.append("methodOut", methodOut);
    formData.append("amountIn", amountIn);
    formData.append("amountOut", calculation.finalTotal.toString());
    formData.append("rate", calculation.rate.toString());
    formData.append("markup", markup.toString());
    formData.append("denominationsIn", JSON.stringify(denomsInArray));
    formData.append("denominationsOut", JSON.stringify(denomsOutArray));
    
    // Incoming Transfer Details
    if (methodIn === "TRANSFER") {
      formData.append("incomingBankName", incomingTransferDetails.bankName);
      formData.append("incomingAccountNumber", incomingTransferDetails.accountNumber);
      formData.append("incomingPayerName", incomingTransferDetails.holderName);
      formData.append("incomingDate", incomingTransferDetails.date);
      formData.append("incomingTrackingId", incomingTransferDetails.trackingId);
      formData.append("incomingTxid", incomingTransferDetails.txid);
      if (incomingFile) {
        formData.append("incomingReceipt", incomingFile);
      }
    }

    // Outgoing Transfer Details
    if (methodOut === "TRANSFER") {
      formData.append("outgoingBankName", outgoingTransferDetails.bankName);
      formData.append("outgoingAccountNumber", outgoingTransferDetails.accountNumber);
      formData.append("outgoingPayerName", outgoingTransferDetails.holderName);
      formData.append("outgoingDate", outgoingTransferDetails.date);
      formData.append("outgoingTrackingId", outgoingTransferDetails.trackingId);
      formData.append("outgoingTxid", outgoingTransferDetails.txid);
      if (outgoingFile) {
        formData.append("outgoingReceipt", outgoingFile);
      }
    }

    try {
      let result;
      
      if (baasMode === "ON_RAMP") {
        // Use the new ACID Fund Wallet endpoint
        const response = await fetch("/api/fxtrader/fund-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedCustomer.id,
            clientName: selectedCustomer.full_name,
            currency: currencyOut.code,
            amount: calculation.finalTotal,
            method: methodIn,
            rate: calculation.rate,
            markup: markup
          })
        });
        
        result = await response.json();
        
        if (result.status === "success") {
          // Update local state in real-time
          setSelectedCustomer({
            ...selectedCustomer,
            walletBalance: result.data.newBalance
          });
          
          // Create a mock ticket for the receipt view
          const ticket = {
            ticketId: result.data.transactionId,
            client: selectedCustomer.full_name,
            currencyIn: currencyIn.code,
            amountIn: parseFloat(amountIn),
            methodIn: methodIn,
            currencyOut: currencyOut.code,
            amountOut: calculation.finalTotal,
            methodOut: "BANCOR_WALLET",
            rate: calculation.rate,
            markup: markup
          };
          
          setShowReceipt(ticket);
          setAmountIn("");
          setIncomingTransferDetails(initialTransferDetails);
          setIncomingFile(null);
          setOutgoingTransferDetails(initialTransferDetails);
          setOutgoingFile(null);
          setBaasMode("NONE");
        } else {
          alert(result.message);
        }
      } else {
        // Standard FX Operation
        const response = await fetch("/api/transactions/close", {
          method: "POST",
          body: formData,
        });

        result = await response.json();
        if (result.status === "success") {
          // If BaaS mode is active (OFF_RAMP), process the wallet transaction
          if (baasMode === "OFF_RAMP") {
            const walletRes = await fetch("/api/baas/wallet/transaction", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: selectedCustomer.id,
                type: "OFF_RAMP",
                currency: currencyIn.code,
                amount: parseFloat(amountIn),
                ticketId: result.ticket.ticketId
              })
            });

            const walletResult = await walletRes.json();
            if (walletResult.status === "error") {
              alert(walletResult.message);
              setIsProcessing(false);
              return;
            }
            
            // Update balance for real-time reflection
            setSelectedCustomer({
              ...selectedCustomer,
              walletBalance: {
                ...selectedCustomer.walletBalance,
                [currencyIn.code]: walletResult.newBalance
              }
            });
          }

          setShowReceipt(result.ticket);
          // Only clear customer if not in BaaS mode to allow seeing the new balance
          if (baasMode === "NONE") {
            setSelectedCustomer(null);
          }
          setCustomerSearch("");
          setAmountIn("");
          setIncomingTransferDetails(initialTransferDetails);
          setIncomingFile(null);
          setOutgoingTransferDetails(initialTransferDetails);
          setOutgoingFile(null);
          setBaasMode("NONE");
        }
      }
    } catch (error) {
      console.error("Error closing operation:", error);
      alert("Error al procesar la operación.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (showReceipt) {
    return (
      <div className="max-w-md mx-auto bg-[#1e2329] border border-[#2b3139] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-8 text-center border-b border-[#2b3139]">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">Operación Exitosa</h2>
          <p className="text-gray-400 text-sm mt-1">Ticket #{showReceipt.ticketId}</p>
        </div>
        
        <div className="p-8 space-y-4 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">CLIENTE:</span>
            <span className="text-white">{showReceipt.client}</span>
          </div>
          <div className="border-t border-[#2b3139] my-2 pt-2">
            <div className="flex justify-between">
              <span className="text-gray-500">RECIBIMOS:</span>
              <span className="text-emerald-500 font-bold">{showReceipt.amountIn.toLocaleString()} {showReceipt.currencyIn}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">MÉTODO:</span>
              <span className="text-gray-400">{showReceipt.methodIn === 'CASH' ? 'EFECTIVO' : 'TRANSFERENCIA'}</span>
            </div>
          </div>
          <div className="border-t border-[#2b3139] my-2 pt-2">
            <div className="flex justify-between">
              <span className="text-gray-500">ENTREGAMOS:</span>
              <span className="text-binance-yellow font-bold">{showReceipt.amountOut.toLocaleString(undefined, { minimumFractionDigits: 2 })} {showReceipt.currencyOut}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">MÉTODO:</span>
              <span className="text-gray-400">{showReceipt.methodOut === 'CASH' ? 'EFECTIVO' : 'TRANSFERENCIA'}</span>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#2b3139]">
            <span className="text-gray-500">TIPO DE CAMBIO:</span>
            <span className="text-white">{showReceipt.rate.toFixed(4)} {showReceipt.currencyOut}/{showReceipt.currencyIn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">MARKUP:</span>
            <span className="text-white">{showReceipt.markup}%</span>
          </div>
        </div>

        <div className="p-6 bg-black/20 flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex-1 bg-[#2b3139] hover:bg-[#363c44] text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Receipt size={18} /> Imprimir
          </button>
          <button 
            onClick={() => setShowReceipt(null)}
            className="flex-1 bg-binance-yellow hover:bg-yellow-500 text-black py-3 rounded-xl font-bold transition-colors"
          >
            Nueva Operación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight className="text-binance-yellow" />
            FX Trader <span className="text-xs font-normal bg-binance-yellow/10 text-binance-yellow px-2 py-0.5 rounded-full uppercase tracking-wider">v3.1</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Cotizador Multidivisa Bidireccional con Validación KYC.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#1e2329] px-3 py-1.5 rounded-full border border-[#2b3139]">
          <RefreshCw size={12} className={isLoadingRates ? "animate-spin" : ""} />
          Tasas actualizadas: {new Date().toLocaleTimeString()}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Search & Info */}
          <section className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <User size={14} /> Validación de Identidad (KYC)
              </label>
              {selectedCustomer && (
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <X size={12} /> Cambiar Cliente
                </button>
              )}
            </div>

            {!selectedCustomer ? (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente por nombre o ID..."
                    className="w-full bg-[#181a20] border border-[#2b3139] rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-binance-yellow transition-colors"
                  />
                  {isSearching && (
                    <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 text-binance-yellow animate-spin" size={18} />
                  )}
                </div>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 w-full mt-2 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-2xl overflow-hidden"
                    >
                      {searchResults.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setSearchResults([]);
                          }}
                          className="w-full p-4 hover:bg-black/20 text-left flex items-center justify-between border-b border-[#2b3139] last:border-0 transition-colors"
                        >
                          <div>
                            <div className="text-white font-medium">{customer.full_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{customer.id}</div>
                          </div>
                          <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            customer.risk_level === 'LOW' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            Riesgo {customer.risk_level}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {customerSearch.length >= 3 && searchResults.length === 0 && !isSearching && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-50 w-full mt-2 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-2xl p-6 text-center"
                    >
                      <UserPlus className="mx-auto text-gray-500 mb-2" size={32} />
                      <p className="text-gray-400 text-sm mb-4">No se encontró ningún cliente con ese nombre.</p>
                      <button 
                        onClick={() => setShowQuickRegister(true)}
                        className="bg-binance-yellow text-black px-6 py-2 rounded-lg font-bold text-sm hover:bg-yellow-500 transition-colors"
                      >
                        Alta Rápida de Cliente
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-black/20 border border-binance-yellow/20 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-binance-yellow/10 text-binance-yellow rounded-full flex items-center justify-center">
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{selectedCustomer.full_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 font-mono">{selectedCustomer.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        selectedCustomer.risk_level === 'LOW' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        Nivel de Riesgo: {selectedCustomer.risk_level}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-500" size={20} />
                  <span className="text-xs text-emerald-500 font-medium">Verificado</span>
                </div>
              </motion.div>
            )}

            {/* VIP BaaS Panel */}
            <AnimatePresence>
              {selectedCustomer?.isVIP && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-4 p-4 bg-gradient-to-br from-binance-yellow/20 to-binance-yellow/5 border border-binance-yellow/30 rounded-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-binance-yellow text-black rounded-lg">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase">Panel Cliente VIP (BaaS)</h4>
                        <p className="text-[10px] text-binance-yellow font-medium">Billetera Digital Activa</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase">Saldo Disponible</p>
                      <p className="text-sm font-mono font-bold text-white">
                        {selectedCustomer.walletBalance?.MXN.toLocaleString()} MXN
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setBaasMode("ON_RAMP");
                        setMethodOut("TRANSFER");
                        setOutgoingTransferDetails({
                          ...initialTransferDetails,
                          bankName: "Bancore Digital Wallet",
                          accountNumber: selectedCustomer.id,
                          holderName: selectedCustomer.full_name
                        });
                      }}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                        baasMode === "ON_RAMP"
                          ? "bg-binance-yellow text-black border-binance-yellow"
                          : "bg-black/20 border-binance-yellow/30 text-binance-yellow hover:bg-binance-yellow/10"
                      }`}
                    >
                      <ArrowUpRight size={14} /> Fondear Billetera
                    </button>
                    <button
                      onClick={() => {
                        const balance = selectedCustomer.walletBalance?.[currencyIn.code as keyof typeof selectedCustomer.walletBalance] || 0;
                        if (amountIn && parseFloat(amountIn) > balance) {
                          alert("Saldo insuficiente, comunícate con tu ejecutivo");
                          return;
                        }
                        setBaasMode("OFF_RAMP");
                        setMethodIn("TRANSFER");
                        setIncomingTransferDetails({
                          ...initialTransferDetails,
                          bankName: "Bancore Digital Wallet",
                          accountNumber: selectedCustomer.id,
                          holderName: selectedCustomer.full_name
                        });
                      }}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                        baasMode === "OFF_RAMP"
                          ? "bg-binance-yellow text-black border-binance-yellow"
                          : "bg-black/20 border-binance-yellow/30 text-binance-yellow hover:bg-binance-yellow/10"
                      }`}
                    >
                      <ArrowDownRight size={14} /> Retiro FIAT
                    </button>
                  </div>

                  {baasMode !== "NONE" && (
                    <div className="mt-3 pt-3 border-t border-binance-yellow/20 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 italic">
                        Modo {baasMode === "ON_RAMP" ? "On-ramp" : "Off-ramp"} activado
                      </span>
                      <button 
                        onClick={() => {
                          setBaasMode("NONE");
                          setMethodIn("CASH");
                          setMethodOut("CASH");
                        }}
                        className="text-[10px] text-binance-red font-bold uppercase hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Bidirectional Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receiving Section */}
            <section className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 space-y-6">
              <h3 className="text-sm font-bold text-emerald-500 uppercase flex items-center gap-2">
                <ArrowRight size={16} /> Lo que Recibimos
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase">Divisa Recibida</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CURRENCIES.map(c => (
                        <button
                          key={c.code}
                          onClick={() => {
                            setCurrencyIn(c);
                            setDenominationsIn({});
                          }}
                          className={`py-2 px-1 rounded-lg border text-xs transition-all ${
                            currencyIn.code === c.code 
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                              : "bg-[#181a20] border-[#2b3139] text-gray-400"
                          }`}
                        >
                          {c.flag} {c.code}
                        </button>
                      ))}
                    </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase">Método de Recepción</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setMethodIn("CASH")}
                      className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        methodIn === "CASH" 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-[#181a20] border-[#2b3139] text-gray-500"
                      }`}
                    >
                      <DollarSign size={16} /> EFECTIVO
                    </button>
                    <button 
                      onClick={() => setMethodIn("TRANSFER")}
                      className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        methodIn === "TRANSFER" 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-[#181a20] border-[#2b3139] text-gray-500"
                      }`}
                    >
                      <RefreshCw size={16} /> TRANSF.
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-500 uppercase">Cantidad Recibida</label>
                    {methodIn === "CASH" && (
                      <div className={`text-[10px] font-bold flex items-center gap-1 p-1 ${isDenomsInValid ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {isDenomsInValid ? (
                          <><CheckCircle2 size={12} /> ARQUEO CUADRADO</>
                        ) : (
                          <button 
                            onClick={() => setShowDenomsModal("IN")}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <AlertCircle size={12} /> PENDIENTE DESGLOSE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{currencyIn.symbol}</span>
                    <input 
                      type="number"
                      value={amountIn}
                      onChange={(e) => setAmountIn(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#181a20] border border-[#2b3139] rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {methodIn === "TRANSFER" && (
                    <TransferFormDetails 
                      title="Detalles de Transferencia Entrante"
                      details={incomingTransferDetails}
                      setDetails={setIncomingTransferDetails}
                      selectedFile={incomingFile}
                      setSelectedFile={setIncomingFile}
                      isCrypto={currencyIn.code === "USDT"}
                      accentColor="emerald"
                    />
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Delivering Section */}
            <section className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 space-y-6">
              <h3 className="text-sm font-bold text-binance-yellow uppercase flex items-center gap-2">
                <ArrowRight size={16} /> Lo que Entregamos
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase">Divisa Entregada</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCurrencyOut(c);
                          setDenominationsOut({});
                        }}
                        className={`py-2 px-1 rounded-lg border text-xs transition-all ${
                          currencyOut.code === c.code 
                            ? "bg-binance-yellow/10 border-binance-yellow text-binance-yellow" 
                            : "bg-[#181a20] border-[#2b3139] text-gray-400"
                        }`}
                      >
                        {c.flag} {c.code}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase">Método de Entrega</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setMethodOut("CASH")}
                      className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        methodOut === "CASH" 
                          ? "bg-binance-yellow/10 border-binance-yellow text-binance-yellow" 
                          : "bg-[#181a20] border-[#2b3139] text-gray-500"
                      }`}
                    >
                      <DollarSign size={16} /> EFECTIVO
                    </button>
                    <button 
                      onClick={() => setMethodOut("TRANSFER")}
                      className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        methodOut === "TRANSFER" 
                          ? "bg-binance-yellow/10 border-binance-yellow text-binance-yellow" 
                          : "bg-[#181a20] border-[#2b3139] text-gray-500"
                      }`}
                    >
                      <RefreshCw size={16} /> TRANSF.
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-500 uppercase">Total a Entregar</label>
                    {methodOut === "CASH" && (
                      <div className={`text-[10px] font-bold flex items-center gap-1 p-1 ${isDenomsOutValid ? 'text-binance-yellow' : 'text-amber-500'}`}>
                        {isDenomsOutValid ? (
                          <><CheckCircle2 size={12} /> ARQUEO CUADRADO</>
                        ) : (
                          <button 
                            onClick={() => setShowDenomsModal("OUT")}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <AlertCircle size={12} /> PENDIENTE DESGLOSE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-full bg-[#181a20]/50 border border-[#2b3139] rounded-xl py-4 px-4 text-2xl font-bold text-binance-yellow min-h-[66px] flex items-center">
                    {currencyOut.symbol}{calculation.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <AnimatePresence>
                  {methodOut === "TRANSFER" && (
                    <TransferFormDetails 
                      title="Datos de Destino (Liquidación Digital)"
                      details={outgoingTransferDetails}
                      setDetails={setOutgoingTransferDetails}
                      selectedFile={outgoingFile}
                      setSelectedFile={setOutgoingFile}
                      isCrypto={currencyOut.code === "USDT"}
                      accentColor="binance-yellow"
                    />
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-6">
          <section className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 shadow-lg sticky top-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Receipt size={16} /> Resumen de Operación
            </h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                <span className="text-gray-500 text-sm">Cliente</span>
                <span className="text-white font-medium">{selectedCustomer?.full_name || "---"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                <span className="text-gray-500 text-sm">Recibimos</span>
                <span className="text-emerald-500 font-bold">{currencyIn.code} ({methodIn})</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                <span className="text-gray-500 text-sm">Entregamos</span>
                <span className="text-binance-yellow font-bold">{currencyOut.code} ({methodOut})</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                <span className="text-gray-500 text-sm">Tasa Cruzada</span>
                <span className="text-white font-mono font-bold">{calculation.rate.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                <span className="text-gray-500 text-sm">Markup</span>
                <span className="text-emerald-500 font-medium">{markup}%</span>
              </div>
              
              <div className="pt-4">
                <div className="text-xs text-gray-500 uppercase mb-1">Total a Entregar</div>
                <div className="text-3xl font-bold text-binance-yellow">
                  {currencyOut.symbol}{calculation.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-xs text-gray-500 ml-2 font-normal">{currencyOut.code}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 italic">
                  * Markup de {currencyOut.symbol}{calculation.markupAmount.toFixed(2)} aplicado.
                </div>
              </div>
            </div>

            <button 
              disabled={!selectedCustomer || !amountIn || isProcessing || !isDenomsInValid || !isDenomsOutValid}
              onClick={handleCloseOperation}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                !selectedCustomer || !amountIn || isProcessing || !isDenomsInValid || !isDenomsOutValid
                  ? "bg-[#2b3139] text-gray-500 cursor-not-allowed"
                  : "bg-binance-yellow hover:bg-yellow-500 text-black transform hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  PROCESANDO...
                </>
              ) : (
                <>
                  CERRAR OPERACIÓN
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <div className="mt-6 p-4 bg-black/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase">
                <AlertCircle size={12} /> Nota de Auditoría
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Esta transacción quedará registrada como {methodIn === 'CASH' ? 'Entrada Física' : 'Entrada Digital'} y {methodOut === 'CASH' ? 'Salida Física' : 'Salida Digital'}. El corte de caja separará ambos rubros automáticamente.
              </p>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showQuickRegister && (
          <QuickRegisterModal 
            onClose={() => setShowQuickRegister(false)} 
            onSuccess={(customer) => {
              setSelectedCustomer(customer);
              setShowQuickRegister(false);
            }}
          />
        )}
        {showDenomsModal && (
          <DenominationsModal 
            type={showDenomsModal}
            currency={showDenomsModal === "IN" ? currencyIn : currencyOut}
            breakdown={showDenomsModal === "IN" ? denominationsIn : denominationsOut}
            setBreakdown={showDenomsModal === "IN" ? setDenominationsIn : setDenominationsOut}
            onClose={() => setShowDenomsModal(null)}
            denoms={denomsConfig[showDenomsModal === "IN" ? currencyIn.code : currencyOut.code] || []}
            targetAmount={showDenomsModal === "IN" ? (parseFloat(amountIn) || 0) : calculation.finalTotal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TransferFormDetails({ 
  title, 
  details, 
  setDetails, 
  selectedFile, 
  setSelectedFile, 
  isCrypto,
  accentColor = "emerald"
}: { 
  title: string, 
  details: TransferDetails, 
  setDetails: (d: TransferDetails) => void,
  selectedFile: File | null,
  setSelectedFile: (f: File | null) => void,
  isCrypto: boolean,
  accentColor?: "emerald" | "binance-yellow"
}) {
  const accentClass = accentColor === "emerald" ? "text-emerald-500" : "text-binance-yellow";
  const borderClass = accentColor === "emerald" ? "focus:border-emerald-500" : "focus:border-binance-yellow";
  const hoverBorderClass = accentColor === "emerald" ? "hover:border-emerald-500/50" : "hover:border-binance-yellow/50";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4 pt-4 border-t border-[#2b3139] overflow-hidden"
    >
      <h4 className={`text-[10px] font-bold ${accentClass} uppercase flex items-center gap-2`}>
        <Info size={12} /> {title}
      </h4>
      
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase">Banco / Red</label>
            <input 
              type="text"
              value={details.bankName}
              onChange={(e) => setDetails({...details, bankName: e.target.value})}
              placeholder="Ej. BBVA o TRON"
              className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase">Cuenta / CLABE</label>
            <input 
              type="text"
              value={details.accountNumber}
              onChange={(e) => setDetails({...details, accountNumber: e.target.value})}
              placeholder="0123..."
              className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass}`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase">Nombre del Titular</label>
          <input 
            type="text"
            value={details.holderName}
            onChange={(e) => setDetails({...details, holderName: e.target.value})}
            placeholder="Nombre completo"
            className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase">Fecha</label>
            <input 
              type="date"
              value={details.date}
              onChange={(e) => setDetails({...details, date: e.target.value})}
              className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase">Clave de rastreo</label>
            <input 
              type="text"
              value={details.trackingId}
              onChange={(e) => setDetails({...details, trackingId: e.target.value})}
              placeholder="ID / Referencia"
              className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass}`}
            />
          </div>
        </div>

        {isCrypto && (
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase">TXID (Transaction Hash)</label>
            <input 
              type="text"
              value={details.txid}
              onChange={(e) => setDetails({...details, txid: e.target.value})}
              placeholder="0x..."
              className={`w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-sm text-white focus:outline-none ${borderClass} font-mono`}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase">Comprobante</label>
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className={`bg-[#181a20] border border-dashed border-[#2b3139] ${hoverBorderClass} rounded-xl p-4 transition-all flex flex-col items-center justify-center gap-2`}>
                {selectedFile ? (
                  <>
                    <FileText className={accentClass} size={24} />
                    <span className="text-xs text-white truncate max-w-[150px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-gray-500" size={24} />
                    <span className="text-xs text-gray-400">Subir archivo (PDF, JPG, PNG)</span>
                  </>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </label>
            {selectedFile && (
              <button 
                onClick={() => setSelectedFile(null)}
                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QuickRegisterModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (customer: Customer) => void }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    estimatedMonthlyAmount: "",
    estimatedOperations: "",
    sourceDestinationFunds: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.fullName) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/kyc/quick-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.status === "success") {
        onSuccess(data.customer);
      }
    } catch (error) {
      console.error("Error in quick register:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[#1e2329] border border-[#2b3139] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-[#2b3139] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="text-binance-yellow" /> Alta Rápida de Cliente (KYC)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Datos Generales</h3>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Nombre Completo</label>
                <input 
                  required
                  type="text" 
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Teléfono</label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                />
              </div>
              <div className="p-3 bg-binance-yellow/5 border border-binance-yellow/20 rounded-xl mt-4">
                <div className="flex gap-2">
                  <Info className="text-binance-yellow shrink-0" size={16} />
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    <span className="text-binance-yellow font-bold">Nota:</span> Solo se permite el registro de clientes <span className="text-white">Estándar</span> desde esta terminal. Para nivel <span className="text-binance-yellow">VIP</span>, dirija al cliente con un Administrador de Cuenta (Módulo BaaS).
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-binance-yellow uppercase tracking-widest">Perfil Transaccional</h3>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Monto estimado mensual (USD)</label>
                <input 
                  type="number" 
                  value={formData.estimatedMonthlyAmount}
                  onChange={(e) => setFormData({...formData, estimatedMonthlyAmount: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Operaciones estimadas / mes</label>
                <input 
                  type="number" 
                  value={formData.estimatedOperations}
                  onChange={(e) => setFormData({...formData, estimatedOperations: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Origen / Destino de Recursos</label>
                <select 
                  value={formData.sourceDestinationFunds}
                  onChange={(e) => setFormData({...formData, sourceDestinationFunds: e.target.value})}
                  className="w-full bg-[#181a20] border border-[#2b3139] rounded-lg py-2 px-3 text-white focus:outline-none focus:border-binance-yellow"
                >
                  <option value="">Seleccione una opción</option>
                  <option value="SALARY">Sueldos y Salarios</option>
                  <option value="BUSINESS">Actividad Empresarial</option>
                  <option value="SAVINGS">Ahorros</option>
                  <option value="INVESTMENTS">Inversiones</option>
                  <option value="OTHER">Otros</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#2b3139] flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#2b3139] text-gray-400 font-bold hover:bg-white/5 transition-colors"
            >
              CANCELAR
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-binance-yellow text-black font-bold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : "REGISTRAR Y VINCULAR"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DenominationsModal({ 
  type, 
  currency, 
  breakdown, 
  setBreakdown, 
  onClose,
  denoms,
  targetAmount
}: { 
  type: "IN" | "OUT", 
  currency: Currency, 
  breakdown: Record<number, number>, 
  setBreakdown: (b: Record<number, number>) => void,
  onClose: () => void,
  denoms: any[],
  targetAmount: number
}) {
  const roundedTarget = Math.round(targetAmount * 100) / 100;
  const total = useMemo(() => {
    return Math.round(Object.entries(breakdown).reduce((sum, [val, qty]) => sum + (parseFloat(val) * qty), 0) * 100) / 100;
  }, [breakdown]);
  const diff = Math.round(Math.abs(total - roundedTarget) * 100) / 100;
  const isValid = diff < 0.01 && total > 0;
  
  const [editingDenom, setEditingDenom] = useState<number | null>(null);

  const getBillImage = (value: number, curr: string) => {
    // Note: These URLs were provided as reference. If they fail, the fallback UI handles it.
    if (curr === 'USD') {
      const mapping: Record<number, string> = {
        1: 'https://storage.googleapis.com/as-artifacts/1_dollar.png',
        2: 'https://storage.googleapis.com/as-artifacts/2_dollars.png',
        5: 'https://storage.googleapis.com/as-artifacts/5_dollars.png',
        10: 'https://storage.googleapis.com/as-artifacts/10_dollars.png',
        20: 'https://storage.googleapis.com/as-artifacts/20_dollars.png',
        50: 'https://storage.googleapis.com/as-artifacts/50_dollars.png',
        100: 'https://storage.googleapis.com/as-artifacts/100_dollars.png',
      };
      return mapping[value] || null;
    }
    return null;
  };

  const getBillColor = (value: number, curr: string) => {
    if (curr === 'USD') return 'bg-emerald-800/40 text-emerald-400 border-emerald-500/30';
    if (curr === 'MXN') {
      if (value >= 1000) return 'bg-purple-800/40 text-purple-400 border-purple-500/30';
      if (value >= 500) return 'bg-blue-800/40 text-blue-400 border-blue-500/30';
      if (value >= 200) return 'bg-green-800/40 text-green-400 border-green-500/30';
      if (value >= 100) return 'bg-red-800/40 text-red-400 border-red-500/30';
      if (value >= 50) return 'bg-pink-800/40 text-pink-400 border-pink-500/30';
      return 'bg-blue-800/40 text-blue-400 border-blue-500/30';
    }
    return 'bg-zinc-800/40 text-zinc-400 border-zinc-500/30';
  };
  
  const handleUpdate = (denom: number, value: number) => {
    const newBreakdown = { ...breakdown, [denom]: value };
    if (value <= 0) delete newBreakdown[denom];
    setBreakdown(newBreakdown);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#1e2329] w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-white/5"
      >
        <div className="p-2.5 border-b border-white/5 flex justify-between items-center bg-[#181a20]/50 backdrop-blur-md text-left">
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-lg transition-colors ${type === "IN" ? "bg-emerald-500 text-black" : "bg-binance-yellow text-black"}`}>
              <Coins size={16} />
            </div>
            <div>
              <h2 className="text-xs font-black text-white tracking-tight leading-none">Arqueo de Caja</h2>
              <span className="block text-[7px] font-medium text-gray-500 uppercase tracking-widest">
                {type === "IN" ? "Recibiendo" : "Entregando"}
              </span>
            </div>

            <div className="flex items-center gap-4 bg-black/40 p-1 px-3 rounded-lg border border-white/5 ml-3">
              <div className="flex flex-col">
                <span className="text-[7px] text-gray-400 uppercase font-bold leading-none mb-0.5">Objetivo</span>
                <span className="text-xs font-bold text-white font-mono">{currency.symbol}{roundedTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-5 w-[1px] bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[7px] text-gray-400 uppercase font-bold leading-none mb-0.5">Conteo</span>
                <span className={`text-xs font-bold font-mono ${isValid ? 'text-emerald-500' : 'text-binance-yellow'}`}>
                  {currency.symbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-5 w-[1px] bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[7px] text-amber-500 uppercase font-bold leading-none mb-0.5">Dif</span>
                <span className={`text-xs font-bold font-mono ${isValid ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isValid ? '0.00' : `${currency.symbol}${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isValid && (
              <button 
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-white transition-colors"
                title="Cerrar sin guardar"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar bg-gradient-to-b from-[#1e2329] to-[#181a20]">
          {denoms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 space-y-3">
              <RefreshCw className="animate-spin text-binance-yellow" size={32} />
              <p className="font-black tracking-widest uppercase text-[10px]">Validando Bóveda...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {denoms.map((denom: any) => {
                const val = denom.denominacion || denom.value;
                const qty = breakdown[val] || 0;
                const isSelected = editingDenom === val;
                const img = getBillImage(val, currency.code);

                return (
                  <motion.div
                    key={val}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditingDenom(val)}
                    className={`group relative flex flex-col p-1 rounded-xl border transition-all cursor-pointer shadow-sm items-center ${
                      isSelected 
                        ? 'border-binance-yellow bg-binance-yellow/10' 
                        : qty > 0 
                          ? 'border-emerald-500/50 bg-emerald-500/5' 
                          : 'border-white/5 bg-[#181a20]/40'
                    }`}
                  >
                    <div className="aspect-[2.5/1] w-full relative rounded-lg overflow-hidden bg-black/60 flex items-center justify-center mb-1 border border-white/5">
                      {img ? (
                        <img 
                          src={img} 
                          alt={`Billete ${val}`} 
                          className={`w-full h-full object-cover transition-all duration-300 ${qty === 0 && !isSelected ? 'grayscale opacity-20' : 'grayscale-0 opacity-100'}`}
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as any).style.display = 'none'; }}
                        />
                      ) : null}
                      
                      <div className={`absolute inset-0 flex flex-col items-center justify-center ${img ? 'hidden' : 'flex'}`}>
                        <span className="text-xl font-black tracking-tighter text-white/90">${val}</span>
                      </div>
                      
                      {qty > 0 && (
                        <div className="absolute top-0.5 right-0.5 bg-emerald-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">
                          {qty}
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="absolute inset-0 bg-binance-yellow/20 backdrop-blur-sm flex items-center justify-center z-20">
                          <Plus className="text-white" size={24} />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center w-full px-1">
                      <div className="flex flex-col text-left">
                        <span className="text-[7px] text-gray-500 font-extrabold uppercase tracking-widest">VAL</span>
                        <span className="text-[10px] font-black text-white">${val}</span>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <span className="text-[7px] text-gray-500 font-extrabold uppercase tracking-widest">SUB</span>
                        <span className={`text-[10px] font-black font-mono tracking-tighter ${qty > 0 ? 'text-emerald-500' : 'text-gray-700'}`}>
                          {(val * qty).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute inset-0 z-30 bg-[#1e2329] border-2 border-binance-yellow rounded-xl flex flex-col items-center justify-center p-3 shadow-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[9px] font-black text-binance-yellow mb-3 tracking-widest uppercase">PIEZAS: {val}</span>
                          <div className="flex items-center gap-4 mb-4">
                            <button 
                              onClick={() => handleUpdate(val, Math.max(0, qty - 1))}
                              className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-red-500 text-white transition-all active:scale-90"
                            >
                              <Minus size={16} />
                            </button>
                            <input 
                              type="number"
                              value={qty || ''}
                              onChange={(e) => handleUpdate(val, Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 bg-transparent text-center border-b-2 border-binance-yellow text-2xl font-black text-white focus:outline-none"
                              placeholder="0"
                              autoFocus
                            />
                            <button 
                              onClick={() => handleUpdate(val, qty + 1)}
                              className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-emerald-500 text-white transition-all active:scale-90"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <button 
                            onClick={() => setEditingDenom(null)}
                            className="bg-binance-yellow text-black px-6 py-1.5 rounded-lg font-black text-[10px] hover:bg-yellow-500 transition-all shadow-xl"
                          >
                            ACEPTAR
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2.5 bg-[#181a20]/80 backdrop-blur-md border-t border-white/5 space-y-2">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col text-left">
              <span className="text-[7px] text-gray-500 uppercase font-black tracking-[0.2em]">Total Arqueado Actual</span>
              <span className={`text-lg font-black font-mono transition-all duration-500 ${isValid ? 'text-emerald-500' : 'text-binance-yellow'}`}>
                {currency.symbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            {!isValid && (
              <div className="bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-2 text-red-500 animate-pulse">
                <AlertCircle size={12} />
                <div className="flex flex-col text-left">
                  <span className="text-[6px] font-black uppercase tracking-widest leading-none">Faltan</span>
                  <span className="text-[10px] font-black font-mono">{currency.symbol}{diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>

          <button 
            disabled={!isValid}
            onClick={onClose}
            className={`w-full py-2 rounded-lg font-black text-xs shadow-xl transition-all flex items-center justify-center gap-2 group ${
              isValid 
                ? (type === 'IN' ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-binance-yellow text-black hover:bg-yellow-400') 
                : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
            }`}
          >
            {isValid ? (
              <>
                <ShieldCheck size={16} /> 
                SINCRONIZAR CON BÓVEDA
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Clock size={14} className="animate-spin" />
                <span className="text-[10px]">EL MONTO DEBE CUADRAR</span>
              </div>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
