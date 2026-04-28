import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Percent } from "lucide-react";

interface SpreadData {
  currency_pair: string;
  current_rates: {
    mid_market_international: number;
    window_buy_rate: number;
    p2p_settlement_rate: number;
  };
  fifo_margin_analysis: {
    period: string;
    total_volume_sold_usd: number;
    average_buy_cost_fifo: number;
    average_sell_price: number;
    gross_margin_mxn: number;
    gross_margin_percentage: number;
  };
  historical_spread_chart: {
    timestamp: string;
    mid_market: number;
    window_buy: number;
    p2p_settlement: number;
    fifo_margin_pct: number;
  }[];
}

export default function SpreadAnalytics() {
  const [data, setData] = useState<SpreadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch for Spread Analytics
    setTimeout(() => {
      setData({
        currency_pair: "USD/MXN",
        current_rates: {
          mid_market_international: 17.05,
          window_buy_rate: 16.80,
          p2p_settlement_rate: 17.15
        },
        fifo_margin_analysis: {
          period: "24h",
          total_volume_sold_usd: 10000.00,
          average_buy_cost_fifo: 16.75,
          average_sell_price: 17.15,
          gross_margin_mxn: 4000.00,
          gross_margin_percentage: 2.38
        },
        historical_spread_chart: [
          { timestamp: "08:00", mid_market: 17.02, window_buy: 16.78, p2p_settlement: 17.12, fifo_margin_pct: 2.02 },
          { timestamp: "10:00", mid_market: 17.04, window_buy: 16.79, p2p_settlement: 17.14, fifo_margin_pct: 2.08 },
          { timestamp: "12:00", mid_market: 17.05, window_buy: 16.80, p2p_settlement: 17.15, fifo_margin_pct: 2.08 },
          { timestamp: "14:00", mid_market: 17.08, window_buy: 16.82, p2p_settlement: 17.18, fifo_margin_pct: 2.14 },
          { timestamp: "16:00", mid_market: 17.06, window_buy: 16.81, p2p_settlement: 17.16, fifo_margin_pct: 2.08 },
          { timestamp: "18:00", mid_market: 17.05, window_buy: 16.80, p2p_settlement: 17.15, fifo_margin_pct: 2.08 }
        ]
      });
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-white">Analítica de Spread</h1>
          <p className="text-gray-400 text-xs lg:text-sm mt-1">Cálculo de margen en tiempo real usando metodología FIFO</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none bg-[#1e2329] border border-[#2b3139] rounded-lg px-3 py-1.5 flex items-center justify-center gap-2">
            <span className="text-xs text-gray-500 font-mono uppercase">Par</span>
            <span className="text-sm font-medium text-white">{data?.currency_pair || "USD/MXN"}</span>
          </div>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-binance-yellow hover:bg-yellow-500 text-black rounded-lg transition-colors text-sm font-medium whitespace-nowrap">
            <TrendingUp size={16} />
            Optimizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando analíticas...</div>
      ) : (
        <>
          {/* Top Rates Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <RateCard 
              title="Tasa de Compra (Ventanilla)" 
              rate={data?.current_rates.window_buy_rate} 
              color="text-binance-teal" 
              bg="bg-binance-teal/10" 
            />
            <RateCard 
              title="Mid-Market (Intl)" 
              rate={data?.current_rates.mid_market_international} 
              color="text-binance-cream" 
              bg="bg-[#1e2329]" 
            />
            <RateCard 
              title="Tasa de Liquidación P2P" 
              rate={data?.current_rates.p2p_settlement_rate} 
              color="text-binance-yellow" 
              bg="bg-binance-yellow/10" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Section */}
            <div className="col-span-1 lg:col-span-2 bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-white">Historial de Spread (24h)</h2>
                <TrendingUp size={20} className="text-gray-500" />
              </div>
              <div className="h-72 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.historical_spread_chart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3b444f" vertical={false} />
                    <XAxis dataKey="timestamp" stroke="#666" tick={{ fill: '#666', fontSize: 12 }} />
                    <YAxis yAxisId="left" domain={['dataMin - 0.1', 'dataMax + 0.1']} stroke="#666" tick={{ fill: '#666', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" domain={['dataMin - 0.2', 'dataMax + 0.2']} stroke="#f27d26" tick={{ fill: '#f27d26', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#2b3139', borderColor: '#3b444f', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#ccc' }} />
                    <Line yAxisId="left" type="monotone" dataKey="p2p_settlement" name="Venta P2P" stroke="#f9b916" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="mid_market" name="Mid-Market" stroke="#f4eadb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="window_buy" name="Compra Ventanilla" stroke="#3b94a3" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="fifo_margin_pct" name="Margen FIFO (%)" stroke="#f27d26" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FIFO Margin Analysis */}
            <div className="col-span-1 bg-[#1e2329] border border-[#2b3139] rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-white">Análisis de Margen FIFO</h2>
                <span className="text-xs font-mono text-binance-orange bg-binance-orange/10 px-2 py-1 rounded uppercase">En Vivo</span>
              </div>

              <div className="space-y-6 flex-1">
                <div className="p-4 bg-[#2b3139] border border-[#3b444f] rounded-xl text-center">
                  <p className="text-sm text-gray-400 font-medium mb-1">Margen Bruto (MXN)</p>
                  <p className="text-3xl font-semibold text-binance-yellow tracking-tight">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MXN' }).format(data?.fifo_margin_analysis.gross_margin_mxn || 0)}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1 text-sm text-binance-yellow font-medium">
                    <ArrowUpRight size={16} />
                    {data?.fifo_margin_analysis.gross_margin_percentage}% ROI
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                    <span className="text-sm text-gray-400">Volumen Vendido (USD)</span>
                    <span className="text-sm font-mono text-white">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data?.fifo_margin_analysis.total_volume_sold_usd || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                    <span className="text-sm text-gray-400">Costo Promedio Compra (FIFO)</span>
                    <span className="text-sm font-mono text-binance-teal">${data?.fifo_margin_analysis.average_buy_cost_fifo.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2b3139]">
                    <span className="text-sm text-gray-400">Precio Promedio Venta (P2P)</span>
                    <span className="text-sm font-mono text-binance-yellow">${data?.fifo_margin_analysis.average_sell_price.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-400">Spread Neto</span>
                    <span className="text-sm font-mono text-white font-medium">
                      ${((data?.fifo_margin_analysis.average_sell_price || 0) - (data?.fifo_margin_analysis.average_buy_cost_fifo || 0)).toFixed(4)} MXN
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RateCard({ title, rate, color, bg }: { title: string; rate?: number; color: string; bg: string }) {
  return (
    <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl p-5 flex flex-col justify-between">
      <h3 className="text-gray-400 text-sm font-medium mb-3">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-gray-500 font-mono text-lg">$</span>
        <span className={`text-3xl font-semibold tracking-tight font-mono ${color}`}>
          {rate?.toFixed(4) || "0.0000"}
        </span>
      </div>
    </div>
  );
}
