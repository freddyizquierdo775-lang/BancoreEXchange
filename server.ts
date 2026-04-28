import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import clearingRoutes from "./src/microservices/clearing-house/routes/clearing.ts";
import db from "./src/db/database.ts";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

console.log("Server.ts starting up...");
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Gateway / Microservices Routes ---
  
  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "BaaS API Gateway" });
  });

  // --- Redis Cache Simulation (In-Memory for MVP) ---
  let redisRates = {
    USD_MXN: { buy: 18.45, sell: 19.55, timestamp: new Date().toISOString() },
    EUR_MXN: { buy: 20.10, sell: 21.30, timestamp: new Date().toISOString() },
    GBP_MXN: { buy: 23.45, sell: 24.80, timestamp: new Date().toISOString() },
    CAD_MXN: { buy: 13.60, sell: 14.45, timestamp: new Date().toISOString() },
    USDT_MXN: { buy: 17.05, sell: 17.10, timestamp: new Date().toISOString() },
    MXN_MXN: { buy: 1.00, sell: 1.00, timestamp: new Date().toISOString() }, // Pivot
  };

  // Simulated Configuration (Markup)
  let systemConfig = {
    transactionalPercentage: 1.5, // 1.5% Markup
  };

  // Módulo 2: Cámara de Compensación (Clearing House)
  app.use("/api/clearing-house", clearingRoutes);

  // Mock ODBC Adapter for SOFTExchange (MySQL 5.1)
  app.get("/api/legacy/balances", (req, res) => {
    // Simulated ODBC connection to Visual FoxPro / MySQL 5.1 legacy system
    res.json({
      status: "success",
      source: "SOFTExchange Legacy",
      data: [
        { currency: "USD", balance: 150000.00, rate: 17.05 },
        { currency: "EUR", balance: 45000.00, rate: 18.50 },
        { currency: "MXN", balance: 2500000.00, rate: 1.00 }
      ]
    });
  });

  // Real-Time Rates Endpoint (Consumes Redis Cache)
  app.get("/api/rates/live", (req, res) => {
    res.json({
      status: "success",
      source: "Redis Cache (Real-Time)",
      rates: redisRates
    });
  });

  // Update Rates Endpoint (Saves to Redis Cache)
  app.post("/api/rates/update", (req, res) => {
    const { rates } = req.body; // Expecting { USD: { buy, sell }, EUR: { buy, sell } }
    
    if (!rates) {
      return res.status(400).json({ status: "error", message: "No rates provided" });
    }

    // Update the "Redis" store
    Object.keys(rates).forEach(code => {
      const pair = `${code}_MXN`;
      redisRates[pair] = {
        buy: rates[code].buy,
        sell: rates[code].sell,
        timestamp: new Date().toISOString()
      };
    });

    console.log("[REDIS] Rates updated successfully:", redisRates);
    
    res.json({
      status: "success",
      message: "Rates updated in Redis cache"
    });
  });

  // Mock PostgreSQL Core ERP Transactions
  const getTransactions = (req, res) => {
    try {
      const transactions = db.prepare(`
        SELECT id, 'IN' as type, currency_in as currency, amount_in as amount, method_in as method, status, created_at as date, client_name as client
        FROM Operaciones_Captacion
        UNION ALL
        SELECT id, 'OUT' as type, currency_out as currency, amount_out as amount, method_out as method, status, created_at as date, client_name as client
        FROM Operaciones_Liquidacion_P2P
        ORDER BY date DESC
        LIMIT 50
      `).all();

      res.json({
        status: "success",
        source: "PostgreSQL Core ERP (Simulated)",
        transactions
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  };

  app.get("/api/transactions/recent", getTransactions);
  app.get("/api/transacciones", getTransactions);

  // --- KYC / Customer Management Endpoints ---

  // Middleware for Role-Based Access Control
  const checkRole = (allowedRoles: string[]) => {
    return (req: any, res: any, next: any) => {
      const userRole = req.headers['x-user-role'] || 'cashier'; // Default to cashier for demo
      if (allowedRoles.includes(userRole)) {
        next();
      } else {
        res.status(403).json({ 
          status: "error", 
          message: "Acceso denegado: Se requiere perfil administrativo para esta acción." 
        });
      }
    };
  };

  // --- BaaS Domain Service ---
  const BaaSService = {
    addFunds: (customerId: string, amount: number, currency: string) => {
      const balanceField = `balance_${currency.toLowerCase()}`;
      
      // Check if wallet exists
      const wallet = db.prepare('SELECT id FROM Wallets WHERE customer_id = ?').get(customerId);
      if (!wallet) {
        throw new Error(`No se encontró billetera digital para el cliente ${customerId}`);
      }

      // Update balance
      const stmt = db.prepare(`
        UPDATE Wallets 
        SET ${balanceField} = ${balanceField} + ? 
        WHERE customer_id = ?
      `);
      const result = stmt.run(amount, customerId);
      
      if (result.changes === 0) {
        throw new Error("Error al actualizar el saldo de la billetera");
      }

      // Get new balance
      return db.prepare('SELECT balance_mxn, balance_usd, balance_usdt FROM Wallets WHERE customer_id = ?').get(customerId);
    }
  };

  // --- FX Trader: Fund Wallet (VIP Integration) ---
  app.post("/api/fxtrader/fund-wallet", (req, res) => {
    const { 
      customerId, 
      clientName,
      currency, 
      amount, 
      method,
      rate,
      markup,
      ticketId 
    } = req.body;

    if (!customerId || !amount || !currency) {
      return res.status(400).json({ status: "error", message: "Datos incompletos para el fondeo" });
    }

    // ACID Transaction
    const executeFondeo = db.transaction((data) => {
      const { customerId, clientName, currency, amount, method, rate, markup, ticketId } = data;

      // 1. Insert into ERP/Accounting (Operaciones_Captacion)
      const captacionId = `CAP-${Math.floor(100000 + Math.random() * 900000)}`;
      db.prepare(`
        INSERT INTO Operaciones_Captacion (
          id, customer_id, client_name, currency_in, amount_in, method_in, 
          currency_out, amount_out, method_out, rate, markup, 
          status, settlement_status, branch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        captacionId,
        customerId,
        clientName,
        currency,
        amount,
        method,
        currency, // Out is same as in for wallet funding
        amount,
        'WALLET_BAAS', // Destination is the BaaS Wallet
        rate || 1,
        markup || 0,
        'COMPLETED',
        currency === 'MXN' ? 'N/A' : 'PENDING',
        'MAIN_BRANCH'
      );

      // 2. Update BaaS Wallet via Service
      const newBalances = BaaSService.addFunds(customerId, amount, currency);

      return {
        captacionId,
        newBalances: {
          MXN: newBalances.balance_mxn,
          USD: newBalances.balance_usd,
          USDT: newBalances.balance_usdt
        }
      };
    });

    try {
      const result = executeFondeo({ customerId, clientName, currency, amount, method, rate, markup, ticketId });
      
      console.log(`[FX->BaaS] Wallet Funded: ${customerId} | +${amount} ${currency}`);

      res.json({
        status: "success",
        message: "Fondeo de billetera exitoso y registrado en contabilidad",
        data: {
          transactionId: result.captacionId,
          newBalance: result.newBalances
        }
      });
    } catch (error: any) {
      console.error("Error in fund-wallet transaction:", error);
      res.status(500).json({ 
        status: "error", 
        message: error.message || "Error interno al procesar el fondeo" 
      });
    }
  });

  // Search Customers (Smart Search)
  app.get("/api/kyc/search", (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ status: "success", data: [] });

    try {
      const customers = db.prepare(`
        SELECT c.*, w.balance_mxn, w.balance_usd, w.balance_usdt, w.id as wallet_id
        FROM Customers c
        LEFT JOIN Wallets w ON c.id = w.customer_id
        WHERE c.full_name LIKE ? OR c.id LIKE ? OR c.email LIKE ?
        LIMIT 10
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);

      const formattedCustomers = customers.map((c: any) => ({
        ...c,
        isVIP: c.is_vip === 1,
        walletBalance: {
          MXN: c.balance_mxn || 0,
          USD: c.balance_usd || 0,
          USDT: c.balance_usdt || 0
        }
      }));

      res.json({ status: "success", data: formattedCustomers });
    } catch (error) {
      console.error("Error searching customers:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // Quick Register Customer (Cashier Level - Standard Only)
  // --- Denominations API ---
  app.get("/api/config/denominations/:currency", (req, res) => {
    const { currency } = req.params;
    
    // Static config for denominations per currency
    const denomsMap: Record<string, number[]> = {
      'USD': [1, 2, 5, 10, 20, 50, 100],
      'MXN': [2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5],
      'EUR': [5, 10, 20, 50, 100, 200, 500],
      'GBP': [5, 10, 20, 50],
      'BRL': [2, 5, 10, 20, 50, 100, 200],
      'CAD': [5, 10, 20, 50, 100]
    };

    const denoms = denomsMap[currency.toUpperCase()] || [100, 50, 20, 10, 5, 1];
    
    // Return structured as expected by frontend
    res.json({
      status: "success",
      data: denoms.map(value => ({ 
        denominacion: value, 
        type: value >= 20 ? 'BILL' : 'COIN',
        label: `${value}` 
      }))
    });
  });

  app.post("/api/kyc/quick-register", (req, res) => {
    const { 
      fullName, 
      email, 
      phone, 
      estimatedMonthlyAmount, 
      estimatedOperations, 
      sourceDestinationFunds 
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ status: "error", message: "Full name is required" });
    }

    try {
      const customerId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // 1. Save to PostgreSQL (SQLite)
      db.prepare(`
        INSERT INTO Customers (
          id, full_name, email, phone, is_vip,
          estimated_monthly_amount, 
          estimated_operations_per_month, 
          source_destination_funds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId, 
        fullName, 
        email || null, 
        phone || null, 
        0, // Always 0 for quick register (cashier)
        estimatedMonthlyAmount || 0, 
        estimatedOperations || 0, 
        sourceDestinationFunds || null
      );

      // 2. Save to Compliance Table
      db.prepare(`
        INSERT INTO Compliance_Expedientes (customer_id, risk_score, verified)
        VALUES (?, ?, ?)
      `).run(customerId, 'LOW', 0);

      console.log(`[KYC] Quick Register: ${customerId} | ${fullName}`);

      res.json({
        status: "success",
        message: "Customer registered successfully",
        customer: {
          id: customerId,
          full_name: fullName,
          risk_level: 'LOW',
          isVIP: false,
          walletBalance: { MXN: 0, USD: 0, USDT: 0 }
        }
      });
    } catch (error) {
      console.error("Error registering customer:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // FX Trader: Close Operation Endpoint
  app.post("/api/transactions/close", upload.fields([
    { name: 'incomingReceipt', maxCount: 1 },
    { name: 'outgoingReceipt', maxCount: 1 }
  ]), (req, res) => {
    const { 
      clientName, 
      customerId,
      currencyIn,
      methodIn,
      currencyOut,
      methodOut,
      amountIn,
      amountOut,
      rate,
      markup,
      // Denominations Breakdown (JSON strings)
      denominationsIn,
      denominationsOut,
      // Incoming Transfer Details
      incomingBankName,
      incomingAccountNumber,
      incomingPayerName,
      incomingDate,
      incomingTrackingId,
      incomingTxid,
      // Outgoing Transfer Details
      outgoingBankName,
      outgoingAccountNumber,
      outgoingPayerName,
      outgoingDate,
      outgoingTrackingId,
      outgoingTxid
    } = req.body;
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const incomingReceipt = files?.incomingReceipt?.[0];
    const outgoingReceipt = files?.outgoingReceipt?.[0];
    
    const incomingReceiptUrl = incomingReceipt ? `/uploads/${incomingReceipt.filename}` : null;
    const outgoingReceiptUrl = outgoingReceipt ? `/uploads/${outgoingReceipt.filename}` : null;
    
    // 1. Validation Logic
    if (!clientName || !currencyIn || !currencyOut || !amountIn || !amountOut) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    try {
      const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const denomsInArray = denominationsIn ? JSON.parse(denominationsIn) : [];
      const denomsOutArray = denominationsOut ? JSON.parse(denominationsOut) : [];

      // 2. PostgreSQL Logic (Simulated with SQLite for MVP)
      const ticketResult = db.transaction(() => {
        // Validation: Sufficient stock for outgoing CASH
        if (methodOut === 'CASH' && denomsOutArray.length > 0) {
          for (const d of denomsOutArray) {
            const stock = db.prepare("SELECT quantity FROM Inventario_Boveda_Detalle WHERE currency = ? AND denominacion = ? AND branch_id = 'MAIN_BRANCH'").get(currencyOut, d.denominacion);
            if (!stock || stock.quantity < d.quantity) {
              throw new Error(`Existencia insuficiente (${stock?.quantity || 0}) para la denominación de ${d.denominacion} ${currencyOut}`);
            }
          }
        }

        // Insert into Captacion (What we receive)
        db.prepare(`
          INSERT INTO Operaciones_Captacion (
            id, customer_id, client_name, currency_in, amount_in, method_in, 
            currency_out, amount_out, method_out, rate, markup, 
            transfer_bank_name, transfer_account_number, transfer_payer_name, 
            transfer_date, transfer_tracking_id, transfer_txid, transfer_receipt_url,
            status, settlement_status, branch_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ticketId, 
          customerId, 
          clientName, 
          currencyIn, 
          amountIn, 
          methodIn, 
          currencyOut, 
          amountOut, 
          methodOut, 
          rate, 
          markup, 
          incomingBankName || null,
          incomingAccountNumber || null,
          incomingPayerName || null,
          incomingDate || null,
          incomingTrackingId || null,
          incomingTxid || null,
          incomingReceiptUrl,
          'COMPLETED',
          currencyIn === 'MXN' ? 'N/A' : 'PENDING',
          'MAIN_BRANCH'
        );

        // Insert into Liquidacion (What we deliver)
        db.prepare(`
          INSERT INTO Operaciones_Liquidacion_P2P (
            id, customer_id, client_name, currency_in, amount_in, method_in, 
            currency_out, amount_out, method_out, rate, markup,
            transfer_bank_name, transfer_account_number, transfer_payer_name, 
            transfer_date, transfer_tracking_id, transfer_txid, transfer_receipt_url,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ticketId, 
          customerId, 
          clientName, 
          currencyIn, 
          amountIn, 
          methodIn, 
          currencyOut, 
          amountOut, 
          methodOut, 
          rate, 
          markup, 
          outgoingBankName || null,
          outgoingAccountNumber || null,
          outgoingPayerName || null,
          outgoingDate || null,
          outgoingTrackingId || null,
          outgoingTxid || null,
          outgoingReceiptUrl,
          methodOut === 'TRANSFER' ? 'PENDING_DISBURSEMENT' : 'COMPLETED'
        );

        // Handle Denominations Detail and Stock
        if (methodIn === 'CASH' && denomsInArray.length > 0) {
          for (const d of denomsInArray) {
            db.prepare('INSERT INTO Operaciones_Denominaciones_Detalle (operation_id, direction, currency, denominacion, quantity) VALUES (?, ?, ?, ?, ?)')
              .run(ticketId, 'IN', currencyIn, d.denominacion, d.quantity);
            
            db.prepare("UPDATE Inventario_Boveda_Detalle SET quantity = quantity + ?, last_update = CURRENT_TIMESTAMP WHERE currency = ? AND denominacion = ? AND branch_id = 'MAIN_BRANCH'")
              .run(d.quantity, currencyIn, d.denominacion);
          }
          db.prepare('UPDATE Boveda SET balance = balance + ?, last_update = CURRENT_TIMESTAMP WHERE currency = ?').run(amountIn, currencyIn);
        }

        if (methodOut === 'CASH' && denomsOutArray.length > 0) {
          for (const d of denomsOutArray) {
            db.prepare('INSERT INTO Operaciones_Denominaciones_Detalle (operation_id, direction, currency, denominacion, quantity) VALUES (?, ?, ?, ?, ?)')
              .run(ticketId, 'OUT', currencyOut, d.denominacion, d.quantity);
            
            db.prepare("UPDATE Inventario_Boveda_Detalle SET quantity = quantity - ?, last_update = CURRENT_TIMESTAMP WHERE currency = ? AND denominacion = ? AND branch_id = 'MAIN_BRANCH'")
              .run(d.quantity, currencyOut, d.denominacion);
          }
          db.prepare('UPDATE Boveda SET balance = balance - ?, last_update = CURRENT_TIMESTAMP WHERE currency = ?').run(amountOut, currencyOut);
        }

        // If it's a transfer/wallet delivery, it goes to the Liquidacion Queue for Treasury
        if (methodOut === 'TRANSFER') {
          db.prepare(`
            INSERT INTO Liquidacion_Tickets (
              id, 
              customer_id,
              client_name, 
              base_currency, 
              base_amount, 
              quote_currency, 
              quote_amount, 
              markup, 
              delivery_method, 
              destination_bank, 
              destination_account, 
              wallet_address,
              transfer_receipt_url,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ticketId, 
            customerId,
            clientName, 
            currencyOut, 
            amountOut, 
            currencyIn, 
            amountIn, 
            markup || 0,
            methodOut,
            outgoingBankName || null,
            outgoingAccountNumber || null,
            outgoingTxid || null, // TXID used as wallet address if applicable
            outgoingReceiptUrl,
            'PENDING'
          );
        }

        return ticketId;
      });

      ticketResult();

      console.log(`[FX TRADER] Operation Closed: ${ticketId} | ${amountIn} ${currencyIn} (${methodIn}) -> ${amountOut} ${currencyOut} (${methodOut})`);

      // 3. Return structured JSON for Ticket Printing
      res.json({
        status: "success",
        message: "Transaction recorded and routed to Treasury if digital",
        ticket: {
          ticketId,
          client: clientName,
          currencyIn,
          methodIn,
          amountIn,
          currencyOut,
          methodOut,
          amountOut,
          rate,
          markup,
          incomingTransfer: methodIn === 'TRANSFER' ? {
            bank: incomingBankName,
            account: incomingAccountNumber,
            payer: incomingPayerName,
            date: incomingDate,
            trackingId: incomingTrackingId,
            txid: incomingTxid,
            receiptUrl: incomingReceiptUrl
          } : null,
          outgoingTransfer: methodOut === 'TRANSFER' ? {
            bank: outgoingBankName,
            account: outgoingAccountNumber,
            payer: outgoingPayerName,
            date: outgoingDate,
            trackingId: outgoingTrackingId,
            txid: outgoingTxid,
            receiptUrl: outgoingReceiptUrl
          } : null,
          status: methodOut === 'TRANSFER' ? 'PENDING_DISBURSEMENT' : 'COMPLETED',
          timestamp: new Date().toISOString(),
          branch: "Sucursal Matriz - Centro",
          cajero: "Admin User",
          legalDisclaimer: "Esta operación está sujeta a liquidación por tesorería si es digital. Conserve este comprobante."
        }
      });
    } catch (error) {
      console.error("Error closing transaction:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // Treasury Queue Endpoint
  app.get("/api/treasury/queue", (req, res) => {
    try {
      const queue = db.prepare(`SELECT * FROM Liquidacion_Tickets WHERE status = 'PENDING' ORDER BY created_at DESC`).all();
      res.json({ status: "success", data: queue });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Error fetching queue" });
    }
  });

  // Get System Config (Markup)
  app.get("/api/config/fx", (req, res) => {
    res.json({ status: "success", config: systemConfig });
  });

  app.get("/api/config/denominations/:currency", (req, res) => {
    const { currency } = req.params;
    try {
      const denoms = db.prepare('SELECT denominacion, type FROM Cat_Denominaciones WHERE currency = ? AND status = "ACTIVE" ORDER BY denominacion DESC').all(currency);
      res.json({ status: "success", data: denoms });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Error fetching denominations" });
    }
  });

  // Mock MongoDB Document Expedientes
  app.get("/api/compliance/documents/:clientId", (req, res) => {
    // Simulated MongoDB fetch
    res.json({
      status: "success",
      source: "MongoDB Expedientes",
      clientId: req.params.clientId,
      documents: [
        { type: "ID", status: "VERIFIED", uploadedAt: "2023-01-15T10:00:00Z" },
        { type: "PROOF_OF_ADDRESS", status: "PENDING_REVIEW", uploadedAt: "2023-10-20T14:30:00Z" }
      ]
    });
  });

  // --- BaaS (Banking-as-a-Service) Module Data Structures ---
  // Data is now unified in SQLite database (baas_platform.db)

  // --- BaaS Endpoints ---

  // BaaS: Dashboard Data (Unified with SQLite)
  app.get("/api/baas/dashboard", (req, res) => {
    try {
      // Fetch all VIP customers
      const customers = db.prepare(`
        SELECT * FROM Customers WHERE is_vip = 1 ORDER BY created_at DESC
      `).all();

      const dashboardData = customers.map((customer: any) => {
        // Fetch wallet
        const wallet = db.prepare('SELECT * FROM Wallets WHERE customer_id = ?').get(customer.id);
        
        // Fetch card
        const card = db.prepare('SELECT * FROM Cards WHERE customer_id = ?').get(customer.id);
        
        // Fetch compliance expediente
        const compliance = db.prepare('SELECT * FROM Compliance_Expedientes WHERE customer_id = ?').get(customer.id);
        
        return {
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          status: wallet?.status || 'ACTIVE',
          createdAt: customer.created_at,
          wallet: wallet ? {
            id: wallet.id,
            balances: {
              MXN: wallet.balance_mxn,
              USD: wallet.balance_usd,
              USDT: wallet.balance_usdt
            }
          } : null,
          card: card ? {
            id: card.id,
            cardNumber: card.card_number,
            type: card.type,
            status: card.status
          } : null,
          compliance: compliance ? {
            riskScore: compliance.risk_score,
            verified: compliance.verified === 1
          } : {
            riskScore: 'PENDING',
            verified: false
          }
        };
      });

      // Fetch global totals
      const totals = db.prepare(`
        SELECT 
          SUM(balance_mxn) as total_mxn,
          SUM(balance_usd) as total_usd,
          SUM(balance_usdt) as total_usdt
        FROM Wallets
      `).get();

      res.json({
        status: "success",
        source: "BaaS Ecosystem (PostgreSQL Unified Schema)",
        data: dashboardData,
        totals: {
          MXN: totals.total_mxn || 0,
          USD: totals.total_usd || 0,
          USDT: totals.total_usdt || 0
        }
      });
    } catch (error) {
      console.error("Error fetching BaaS dashboard:", error);
      res.status(500).json({ status: "error", message: "Error al cargar el dashboard de BaaS" });
    }
  });

  // Register VIP User
  // BaaS: Exclusive VIP Registration (Admin Only)
  app.post("/api/baas/vip-users", checkRole(['admin']), (req, res) => {
    const { 
      fullName, 
      email, 
      phone, 
      initialBalanceMXN,
      estimatedMonthlyAmount, 
      estimatedOperations, 
      sourceDestinationFunds 
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ status: "error", message: "Full name is required" });
    }

    try {
      const customerId = `CUST-VIP-${Math.floor(100000 + Math.random() * 900000)}`;
      
      db.transaction(() => {
        // 1. Create Customer
        db.prepare(`
          INSERT INTO Customers (
            id, full_name, email, phone, is_vip,
            estimated_monthly_amount, 
            estimated_operations_per_month, 
            source_destination_funds
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          customerId, 
          fullName, 
          email || null, 
          phone || null, 
          1, // Always 1 for VIP registration
          estimatedMonthlyAmount || 0, 
          estimatedOperations || 0, 
          sourceDestinationFunds || null
        );

        // 2. Create Wallet
        const walletId = `WLT-${Math.floor(100000 + Math.random() * 900000)}`;
        db.prepare(`
          INSERT INTO Wallets (id, customer_id, balance_mxn, balance_usd, balance_usdt)
          VALUES (?, ?, ?, ?, ?)
        `).run(walletId, customerId, initialBalanceMXN || 0, 0, 0);

        // 3. Create Compliance Expediente
        db.prepare(`
          INSERT INTO Compliance_Expedientes (customer_id, risk_score, verified)
          VALUES (?, ?, ?)
        `).run(customerId, 'LOW', 1); // Auto-verify for demo/MVP
      })();

      console.log(`[BaaS] VIP Registered: ${customerId} | ${fullName}`);

      res.json({
        status: "success",
        message: "VIP Customer, Wallet and Compliance created successfully",
        customer: {
          id: customerId,
          full_name: fullName,
          isVIP: true
        }
      });
    } catch (error) {
      console.error("Error registering VIP user:", error);
      res.status(500).json({ status: "error", message: "Database error during registration" });
    }
  });

  // Assign Card Manually
  app.post("/api/baas/assign-card", (req, res) => {
    const { userId, cardNumber } = req.body;

    if (!userId || !cardNumber) {
      return res.status(400).json({ status: "error", message: "User ID and Card Number are required" });
    }

    try {
      // Validate customer exists
      const customer = db.prepare('SELECT id FROM Customers WHERE id = ?').get(userId);
      if (!customer) {
        return res.status(404).json({ status: "error", message: "Customer not found" });
      }

      // Check if card already assigned
      const existingCard = db.prepare('SELECT id FROM Cards WHERE customer_id = ?').get(userId);
      if (existingCard) {
        return res.status(400).json({ status: "error", message: "User already has a card assigned" });
      }

      // Mask card number for storage (simulated)
      const masked = `${cardNumber.substring(0, 4)} **** **** ${cardNumber.substring(cardNumber.length - 4)}`;

      const cardId = `C-${Math.floor(1000 + Math.random() * 9000)}`;
      db.prepare(`
        INSERT INTO Cards (id, customer_id, card_number, type, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(cardId, userId, masked, "MASTERCARD_PLATINUM", "ACTIVE");

      console.log(`[BaaS] Card Assigned: ${userId} -> ${masked}`);

      res.json({
        status: "success",
        message: "Physical card linked to VIP account and digital wallet",
        card: { id: cardId, cardNumber: masked }
      });
    } catch (error) {
      console.error("Error assigning card:", error);
      res.status(500).json({ status: "error", message: "Database error during card assignment" });
    }
  });

  // BaaS: Wallet Transaction Endpoints
  app.post("/api/baas/wallet/transaction", (req, res) => {
    const { customerId, type, currency, amount, ticketId } = req.body;

    if (!customerId || !type || !currency || !amount) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    try {
      const wallet = db.prepare(`SELECT * FROM Wallets WHERE customer_id = ?`).get(customerId);
      if (!wallet) {
        return res.status(404).json({ status: "error", message: "Wallet not found for this customer" });
      }

      const balanceField = `balance_${currency.toLowerCase()}`;
      const currentBalance = wallet[balanceField] || 0;

      if (type === 'OFF_RAMP' && currentBalance < amount) {
        return res.status(400).json({ 
          status: "error", 
          message: "Saldo insuficiente, comunícate con tu ejecutivo",
          code: "INSUFFICIENT_FUNDS"
        });
      }

      const newBalance = type === 'ON_RAMP' ? currentBalance + amount : currentBalance - amount;

      db.prepare(`UPDATE Wallets SET ${balanceField} = ? WHERE customer_id = ?`)
        .run(newBalance, customerId);

      console.log(`[BaaS] Wallet ${type}: ${customerId} | ${amount} ${currency} | New Balance: ${newBalance}`);

      res.json({
        status: "success",
        message: `Wallet ${type === 'ON_RAMP' ? 'funded' : 'debited'} successfully`,
        newBalance
      });
    } catch (error) {
      console.error("Error processing wallet transaction:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // --- Global Liquidity Hub Endpoints ---

  // 1. Settlement Queue (Cola de Liquidaciones)
  app.get("/api/liquidity/queue", (req, res) => {
    try {
      // Fetch pending 'Compra' operations (where we bought foreign currency from customer)
      const queue = db.prepare(`
        SELECT * FROM Operaciones_Captacion 
        WHERE settlement_status = 'PENDING' 
        AND currency_in != 'MXN'
        ORDER BY created_at ASC
      `).all();

      // Aggregated totals per currency
      const aggregated = db.prepare(`
        SELECT 
          currency_in as currency,
          COUNT(*) as record_count,
          SUM(amount_in) as total_amount,
          SUM(amount_out) as total_cost_mxn,
          AVG(rate) as avg_buy_rate
        FROM Operaciones_Captacion
        WHERE settlement_status = 'PENDING' 
        AND currency_in != 'MXN'
        GROUP BY currency_in
      `).all();

      // Mock market rates (Simulating Redis/Bitacora_Tasas_Mercado)
      const marketRates: any = {
        'USD': { interbank: 17.05, p2p: 17.15 },
        'USDT': { interbank: 17.10, p2p: 17.20 },
        'EUR': { interbank: 18.50, p2p: 18.65 }
      };

      const enrichedQueue = queue.map((item: any) => ({
        ...item,
        marketRates: marketRates[item.currency_in] || { interbank: item.rate, p2p: item.rate }
      }));

      const enrichedAggregated = aggregated.map((item: any) => ({
        ...item,
        marketRates: marketRates[item.currency] || { interbank: item.avg_buy_rate, p2p: item.avg_buy_rate }
      }));

      res.json({ 
        status: "success", 
        data: {
          items: enrichedQueue,
          aggregated: enrichedAggregated
        }
      });
    } catch (error) {
      console.error("Error fetching liquidity queue:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // 2. Process General Liquidation (FIFO Sweep)
  app.post("/api/liquidity/liquidate-general", (req, res) => {
    const { currency, finalPriceSold } = req.body;

    if (!currency || !finalPriceSold) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    try {
      // Fetch all pending captures for this currency in FIFO order
      const pendingCaptures = db.prepare(`
        SELECT * FROM Operaciones_Captacion 
        WHERE settlement_status = 'PENDING' 
        AND currency_in = ?
        ORDER BY created_at ASC
      `).all(currency);

      if (pendingCaptures.length === 0) {
        return res.status(404).json({ status: "error", message: "No pending positions for this currency" });
      }

      const totalAmount = pendingCaptures.reduce((sum: number, item: any) => sum + item.amount_in, 0);
      const totalCostMXN = pendingCaptures.reduce((sum: number, item: any) => sum + item.amount_out, 0);
      const totalRevenueMXN = totalAmount * finalPriceSold;
      const totalProfitMXN = totalRevenueMXN - totalCostMXN;

      const transaction = db.transaction(() => {
        const liquidacionId = `LIQ-GEN-${Math.floor(100000 + Math.random() * 900000)}`;

        // a) Register the General Liquidation in P2P table
        db.prepare(`
          INSERT INTO Operaciones_Liquidacion_P2P (
            id, client_name, currency_in, amount_in, method_in, 
            currency_out, amount_out, method_out, rate, markup, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          liquidacionId,
          'GENERAL_TREASURY_LIQUIDATION',
          currency,
          totalAmount,
          'INTERNAL_AGGREGATION',
          'MXN',
          totalRevenueMXN,
          'VAULT_REINJECTION',
          finalPriceSold,
          0,
          'COMPLETED'
        );

        // b) FIFO Sweep: Update each capture record and link to traceability
        let rank = 1;
        for (const captacion of pendingCaptures) {
          // Mark as Liquidated
          db.prepare('UPDATE Operaciones_Captacion SET settlement_status = "LIQUIDATED" WHERE id = ?')
            .run(captacion.id);

          // Calculate individual record profit
          const recordRevenue = captacion.amount_in * finalPriceSold;
          const recordProfit = recordRevenue - captacion.amount_out;
          const spread = finalPriceSold - captacion.rate;

          // Link to Traz_Flujo_Rentabilidad
          db.prepare(`
            INSERT INTO Traz_Flujo_Rentabilidad (
              captacion_id, liquidacion_id, spread, profit_mxn, fifo_rank
            ) VALUES (?, ?, ?, ?, ?)
          `).run(captacion.id, liquidacionId, spread, recordProfit, rank++);
        }

        // c) Update Boveda (Subtract total foreign currency, add total MXN)
        db.prepare('UPDATE Boveda SET balance = balance - ?, last_update = CURRENT_TIMESTAMP WHERE currency = ?')
          .run(totalAmount, currency);
        
        db.prepare('UPDATE Boveda SET balance = balance + ?, last_update = CURRENT_TIMESTAMP WHERE currency = "MXN"')
          .run(totalRevenueMXN);

        return {
          liquidacionId,
          totalAmount,
          totalProfitMXN,
          recordsProcessed: pendingCaptures.length
        };
      });

      const result = transaction();

      res.json({ 
        status: "success", 
        message: `General liquidation for ${currency} completed successfully`,
        data: result
      });
    } catch (error) {
      console.error("Error processing general liquidation:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // 2. Process Liquidation (Manual)
  app.post("/api/liquidity/liquidate", (req, res) => {
    const { captacionId, finalPriceSold } = req.body;

    if (!captacionId || !finalPriceSold) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    try {
      const captacion = db.prepare('SELECT * FROM Operaciones_Captacion WHERE id = ?').get(captacionId);
      if (!captacion) {
        return res.status(404).json({ status: "error", message: "Capture operation not found" });
      }

      const transaction = db.transaction(() => {
        // a) Mark as Liquidated
        db.prepare('UPDATE Operaciones_Captacion SET settlement_status = "LIQUIDATED" WHERE id = ?')
          .run(captacionId);

        // b) Register in Operaciones_Liquidacion_P2P
        const liquidacionId = `LIQ-P2P-${Math.floor(100000 + Math.random() * 900000)}`;
        const amountOutMXN = captacion.amount_in * finalPriceSold;
        
        db.prepare(`
          INSERT INTO Operaciones_Liquidacion_P2P (
            id, client_name, currency_in, amount_in, method_in, 
            currency_out, amount_out, method_out, rate, markup, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          liquidacionId,
          'MARKET_LIQUIDATION',
          captacion.currency_in,
          captacion.amount_in,
          'INTERNAL_TRANSFER',
          'MXN',
          amountOutMXN,
          'VAULT_REINJECTION',
          finalPriceSold,
          0,
          'COMPLETED'
        );

        // c) Update Boveda (Subtract foreign currency, add MXN)
        db.prepare('UPDATE Boveda SET balance = balance - ?, last_update = CURRENT_TIMESTAMP WHERE currency = ?')
          .run(captacion.amount_in, captacion.currency_in);
        
        db.prepare('UPDATE Boveda SET balance = balance + ?, last_update = CURRENT_TIMESTAMP WHERE currency = "MXN"')
          .run(amountOutMXN);

        // d) FIFO Utility Calculation & Traceability
        const costMXN = captacion.amount_out;
        const profitMXN = amountOutMXN - costMXN;
        const spread = finalPriceSold - captacion.rate;

        db.prepare(`
          INSERT INTO Traz_Flujo_Rentabilidad (
            captacion_id, liquidacion_id, spread, profit_mxn, fifo_rank
          ) VALUES (?, ?, ?, ?, ?)
        `).run(captacionId, liquidacionId, spread, profitMXN, 1);

        return { liquidacionId, profitMXN };
      });

      const result = transaction();

      res.json({ 
        status: "success", 
        message: "Position liquidated and capital reinjected successfully",
        data: result
      });
    } catch (error) {
      console.error("Error processing liquidation:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // 3. Monthly Performance
  app.get("/api/liquidity/performance", (req, res) => {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      
      const performance = db.prepare(`
        SELECT 
          COUNT(*) as total_liquidations,
          SUM(profit_mxn) as total_profit_mxn,
          AVG(spread) as avg_spread
        FROM Traz_Flujo_Rentabilidad
        WHERE strftime('%Y-%m', created_at) = ?
      `).get(currentMonth);

      res.json({ 
        status: "success", 
        data: {
          month: currentMonth,
          totalProfit: performance.total_profit_mxn || 0,
          count: performance.total_liquidations || 0,
          avgSpread: performance.avg_spread || 0
        }
      });
    } catch (error) {
      console.error("Error fetching performance:", error);
      res.status(500).json({ status: "error", message: "Database error" });
    }
  });

  // Serve uploads directory
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
