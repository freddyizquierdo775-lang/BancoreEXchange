import { useState, useEffect } from "react";
import { Search, Filter, UserPlus, ShieldAlert, FileCheck, FileWarning } from "lucide-react";

interface Client {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "CORPORATE";
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  kyc_status: "VERIFIED" | "PENDING" | "REJECTED";
  last_activity: string;
  cnbv_status: "CLEARED" | "FLAGGED";
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching clients from MongoDB
    setTimeout(() => {
      setClients([
        { id: "CLI-001", name: "Juan Perez", type: "INDIVIDUAL", risk_level: "LOW", kyc_status: "VERIFIED", last_activity: new Date().toISOString(), cnbv_status: "CLEARED" },
        { id: "CLI-002", name: "Empresa S.A.", type: "CORPORATE", risk_level: "MEDIUM", kyc_status: "PENDING", last_activity: new Date(Date.now() - 86400000).toISOString(), cnbv_status: "CLEARED" },
        { id: "CLI-003", name: "Carlos Lopez", type: "INDIVIDUAL", risk_level: "HIGH", kyc_status: "VERIFIED", last_activity: new Date(Date.now() - 172800000).toISOString(), cnbv_status: "FLAGGED" },
        { id: "CLI-004", name: "Maria Garcia", type: "INDIVIDUAL", risk_level: "LOW", kyc_status: "REJECTED", last_activity: new Date(Date.now() - 259200000).toISOString(), cnbv_status: "CLEARED" },
        { id: "CLI-005", name: "Tech Solutions LLC", type: "CORPORATE", risk_level: "LOW", kyc_status: "VERIFIED", last_activity: new Date(Date.now() - 345600000).toISOString(), cnbv_status: "CLEARED" },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-white">Clientes y KYC</h1>
          <p className="text-gray-400 text-xs lg:text-sm mt-1">Gestiona perfiles de clientes, documentos KYC y cumplimiento CNBV</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-[#1e2329] hover:bg-[#2b3139] text-white rounded-lg transition-colors text-sm font-medium border border-[#3b444f]">
            <Filter size={16} />
            Filtrar
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-binance-yellow hover:bg-yellow-500 text-black rounded-lg transition-colors text-sm font-medium whitespace-nowrap">
            <UserPlus size={16} />
            Nuevo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-binance-yellow/10 flex items-center justify-center">
            <FileCheck className="text-binance-yellow" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Perfiles Verificados</p>
            <p className="text-2xl font-semibold text-white">1,102</p>
          </div>
        </div>
        <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-binance-orange/10 flex items-center justify-center">
            <FileWarning className="text-binance-orange" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">KYC Pendiente</p>
            <p className="text-2xl font-semibold text-white">143</p>
          </div>
        </div>
        <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-binance-red/10 flex items-center justify-center">
            <ShieldAlert className="text-binance-red" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Marcados por CNBV</p>
            <p className="text-2xl font-semibold text-white">1</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2b3139] flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, ID o RFC..." 
              className="w-full bg-[#2b3139] border border-[#3b444f] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-binance-yellow transition-colors text-white"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3b444f] text-xs uppercase tracking-wider text-gray-500 bg-[#2b3139]">
                <th className="p-4 font-medium">ID Cliente</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Nivel de Riesgo</th>
                <th className="p-4 font-medium">Estado KYC</th>
                <th className="p-4 font-medium">Lista CNBV</th>
                <th className="p-4 font-medium text-right">Última Actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Cargando clientes...</td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#2b3139] transition-colors group cursor-pointer">
                    <td className="p-4 font-mono text-sm text-gray-300 group-hover:text-binance-yellow transition-colors">{client.id}</td>
                    <td className="p-4 text-sm font-medium text-white">{client.name}</td>
                    <td className="p-4">
                      <span className="text-xs text-gray-400 font-medium tracking-wide">
                        {client.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-medium ${
                        client.risk_level === 'LOW' ? 'text-binance-yellow' : 
                        client.risk_level === 'MEDIUM' ? 'text-binance-orange' : 'text-binance-red'
                      }`}>
                        {client.risk_level}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                        client.kyc_status === 'VERIFIED' ? 'bg-binance-yellow/10 text-binance-yellow' : 
                        client.kyc_status === 'PENDING' ? 'bg-binance-orange/10 text-binance-orange' : 'bg-binance-red/10 text-binance-red'
                      }`}>
                        {client.kyc_status}
                      </span>
                    </td>
                    <td className="p-4">
                      {client.cnbv_status === 'CLEARED' ? (
                        <span className="flex items-center gap-1 text-xs text-binance-yellow">
                          <ShieldAlert size={14} className="opacity-50" />
                          Limpio
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-binance-red font-bold">
                          <ShieldAlert size={14} />
                          MARCADO
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right text-sm text-gray-500 font-mono">
                      {new Date(client.last_activity).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
