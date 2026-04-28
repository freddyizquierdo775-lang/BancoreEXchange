import { useState, useEffect } from "react";
import { Search, Filter, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  currency: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  client: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch("/api/transactions/recent");
        const data = await res.json();
        if (data.status === "success") {
          setTransactions(data.transactions);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-white">Transacciones</h1>
          <p className="text-gray-400 text-xs lg:text-sm mt-1">Gestiona y visualiza todas las transacciones de la plataforma</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-[#1e2329] hover:bg-[#2b3139] text-white rounded-lg transition-colors text-sm font-medium border border-[#3b444f]">
            <Filter size={16} />
            Filtrar
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-binance-yellow hover:bg-yellow-500 text-black rounded-lg transition-colors text-sm font-medium">
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>

      <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl lg:rounded-2xl overflow-hidden">
        <div className="p-3 lg:p-4 border-b border-[#2b3139] flex items-center gap-4">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por ID, cliente o monto..." 
              className="w-full bg-[#2b3139] border border-[#3b444f] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-binance-yellow transition-colors text-white"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3b444f] text-xs uppercase tracking-wider text-gray-500 bg-[#2b3139]">
                <th className="p-4 font-medium">ID Transacción</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium text-right">Monto</th>
                <th className="p-4 font-medium">Método</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium text-right">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Cargando transacciones...</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={`${tx.id}-${tx.type}`} className="hover:bg-[#2b3139] transition-colors group cursor-pointer">
                    <td className="p-4 font-mono text-sm text-gray-300 group-hover:text-binance-yellow transition-colors">{tx.id}</td>
                    <td className="p-4 text-sm font-medium text-white">{tx.client}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${
                        tx.type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-binance-yellow/10 text-binance-yellow'
                      }`}>
                        {tx.type === 'IN' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                        {tx.type} {tx.currency}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-white">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(tx.amount)}
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-gray-400 font-medium uppercase">
                        {tx.method === 'CASH' ? 'EFECTIVO' : 'TRANSFERENCIA'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${
                        tx.status === 'COMPLETED' ? 'text-binance-yellow' : 
                        tx.status === 'PENDING_DISBURSEMENT' ? 'text-binance-orange' : 'text-binance-red'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          tx.status === 'COMPLETED' ? 'bg-binance-yellow' : 
                          tx.status === 'PENDING_DISBURSEMENT' ? 'bg-binance-orange' : 'bg-binance-red'
                        }`}></div>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-4 text-right text-sm text-gray-500 font-mono">
                      {new Date(tx.date).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[#2b3139] flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {transactions.length} de 1,245 transacciones</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[#3b444f] rounded hover:bg-[#2b3139] transition-colors disabled:opacity-50">Anterior</button>
            <button className="px-3 py-1 border border-[#3b444f] rounded hover:bg-[#2b3139] transition-colors">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
