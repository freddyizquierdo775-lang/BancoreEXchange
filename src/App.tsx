/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Clients from "./pages/Clients";
import LiquidityHub from "./pages/LiquidityHub";
import SpreadAnalytics from "./pages/SpreadAnalytics";
import Settings from "./pages/Settings";
import FXTrader from "./pages/FXTrader";
import BaaS from "./pages/BaaS";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "baas" && <BaaS />}
      {activeTab === "fx-trader" && <FXTrader />}
      {activeTab === "liquidity" && <LiquidityHub />}
      {activeTab === "analytics" && <SpreadAnalytics />}
      {activeTab === "transactions" && <Transactions />}
      {activeTab === "clients" && <Clients />}
      {activeTab === "compliance" && (
        <div className="flex items-center justify-center h-full text-gray-500">
          Módulo de Cumplimiento (CNBV) - Próximamente
        </div>
      )}
      {activeTab === "settings" && <Settings />}
    </DashboardLayout>
  );
}
