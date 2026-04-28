import Database from "better-sqlite3";
import path from "path";

let db: any;

try {
  db = new Database("baas_platform.db");
  console.log("Database initialized successfully");
} catch (error) {
  console.error("Failed to initialize database, using in-memory mock:", error);
  // Fallback to in-memory if file-based fails
  db = new Database(":memory:");
}

// Initialize tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Operaciones_Captacion (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      client_name TEXT NOT NULL,
      currency_in TEXT NOT NULL,
      amount_in REAL NOT NULL,
      method_in TEXT NOT NULL,
      currency_out TEXT NOT NULL,
      amount_out REAL NOT NULL,
      method_out TEXT NOT NULL,
      rate REAL NOT NULL,
      markup REAL NOT NULL,
      transfer_bank_name TEXT,
      transfer_account_number TEXT,
      transfer_payer_name TEXT,
      transfer_date TEXT,
      transfer_tracking_id TEXT,
      transfer_txid TEXT,
      transfer_receipt_url TEXT,
      status TEXT DEFAULT 'COMPLETED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Operaciones_Liquidacion_P2P (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      client_name TEXT NOT NULL,
      currency_in TEXT NOT NULL,
      amount_in REAL NOT NULL,
      method_in TEXT NOT NULL,
      currency_out TEXT NOT NULL,
      amount_out REAL NOT NULL,
      method_out TEXT NOT NULL,
      rate REAL NOT NULL,
      markup REAL NOT NULL,
      transfer_bank_name TEXT,
      transfer_account_number TEXT,
      transfer_payer_name TEXT,
      transfer_date TEXT,
      transfer_tracking_id TEXT,
      transfer_txid TEXT,
      transfer_receipt_url TEXT,
      status TEXT DEFAULT 'COMPLETED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Traz_Flujo_Rentabilidad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captacion_id TEXT,
      liquidacion_id TEXT,
      spread REAL,
      profit_mxn REAL,
      fifo_rank INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (captacion_id) REFERENCES Operaciones_Captacion(id),
      FOREIGN KEY (liquidacion_id) REFERENCES Operaciones_Liquidacion_P2P(id)
    );

    CREATE TABLE IF NOT EXISTS Liquidacion_Tickets (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      client_name TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      base_amount REAL NOT NULL,
      quote_currency TEXT NOT NULL,
      quote_amount REAL NOT NULL,
      markup REAL NOT NULL,
      delivery_method TEXT NOT NULL,
      destination_bank TEXT,
      destination_account TEXT,
      wallet_address TEXT,
      transfer_receipt_url TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      risk_level TEXT DEFAULT 'LOW',
      is_vip INTEGER DEFAULT 0,
      estimated_monthly_amount REAL,
      estimated_operations_per_month INTEGER,
      source_destination_funds TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE,
      balance_mxn REAL DEFAULT 0,
      balance_usd REAL DEFAULT 0,
      balance_usdt REAL DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id)
    );

    CREATE TABLE IF NOT EXISTS Cards (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE,
      card_number TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id)
    );

    CREATE TABLE IF NOT EXISTS Compliance_Expedientes (
      customer_id TEXT PRIMARY KEY,
      risk_score TEXT DEFAULT 'PENDING',
      verified INTEGER DEFAULT 0,
      last_review DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id)
    );

    CREATE TABLE IF NOT EXISTS Compliance_Documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id)
    );

    CREATE TABLE IF NOT EXISTS Boveda (
      id TEXT PRIMARY KEY,
      currency TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Cat_Denominaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT NOT NULL,
      denominacion REAL NOT NULL,
      type TEXT DEFAULT 'BILL', -- 'BILL' or 'COIN'
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS Inventario_Boveda_Detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id TEXT DEFAULT 'MAIN_BRANCH',
      currency TEXT NOT NULL,
      denominacion REAL NOT NULL,
      quantity INTEGER DEFAULT 0,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(branch_id, currency, denominacion)
    );

    CREATE TABLE IF NOT EXISTS Operaciones_Denominaciones_Detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL,
      direction TEXT NOT NULL, -- 'IN' (received) or 'OUT' (delivered)
      currency TEXT NOT NULL,
      denominacion REAL NOT NULL,
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize Boveda with default currencies if empty
  const bovedaCount = db.prepare('SELECT COUNT(*) as count FROM Boveda').get();
  if (bovedaCount.count === 0) {
    const currencies = ['MXN', 'USD', 'USDT', 'EUR'];
    const insert = db.prepare('INSERT INTO Boveda (id, currency, balance) VALUES (?, ?, ?)');
    currencies.forEach(curr => insert.run(`BOV-${curr}`, curr, 1000000)); // Start with 1M each for demo
  }

  // Initialize Catalog of Denominations if empty
  const denCount = db.prepare('SELECT COUNT(*) as count FROM Cat_Denominaciones').get();
  if (denCount.count === 0) {
    const denoms = [
      { currency: 'MXN', values: [1000, 500, 200, 100, 50, 20], type: 'BILL' },
      { currency: 'MXN', values: [10, 5, 2, 1, 0.5], type: 'COIN' },
      { currency: 'USD', values: [100, 50, 20, 10, 5, 2, 1], type: 'BILL' },
      { currency: 'EUR', values: [500, 200, 100, 50, 20, 10, 5], type: 'BILL' }
    ];
    const insertDen = db.prepare('INSERT OR IGNORE INTO Cat_Denominaciones (currency, denominacion, type) VALUES (?, ?, ?)');
    const insertInv = db.prepare('INSERT OR IGNORE INTO Inventario_Boveda_Detalle (currency, denominacion, quantity) VALUES (?, ?, ?)');
    
    denoms.forEach(d => {
      d.values.forEach(v => {
        insertDen.run(d.currency, v, d.type);
        // Start with some inventory for demo
        insertInv.run(d.currency, v, 1000); 
      });
    });
  }

  // Ensure ALL catalog denominations exist in the inventory (for newly added ones)
  const allDenoms = db.prepare('SELECT currency, denominacion FROM Cat_Denominaciones').all();
  const insertMissingInv = db.prepare('INSERT OR IGNORE INTO Inventario_Boveda_Detalle (currency, denominacion, quantity) VALUES (?, ?, ?)');
  allDenoms.forEach((d: any) => {
    insertMissingInv.run(d.currency, d.denominacion, 1000);
  });

  // Migrations for missing columns in existing tables
  const tablesToMigrate = ['Operaciones_Captacion', 'Operaciones_Liquidacion_P2P'];
  tablesToMigrate.forEach(table => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const columnNames = columns.map((c: any) => c.name);

    if (!columnNames.includes('customer_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN customer_id TEXT`);
    }
    if (!columnNames.includes('branch_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN branch_id TEXT DEFAULT 'MAIN_BRANCH'`);
    }
    if (!columnNames.includes('currency_out')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN currency_out TEXT NOT NULL DEFAULT 'MXN'`);
    }
    if (!columnNames.includes('amount_out')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN amount_out REAL NOT NULL DEFAULT 0`);
    }
    if (!columnNames.includes('method_out')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN method_out TEXT NOT NULL DEFAULT 'CASH'`);
    }
    if (!columnNames.includes('rate')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN rate REAL NOT NULL DEFAULT 1`);
    }
    if (!columnNames.includes('markup')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN markup REAL NOT NULL DEFAULT 0`);
    }
    if (!columnNames.includes('settlement_status')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN settlement_status TEXT DEFAULT 'PENDING'`);
    }
    
    // Transfer traceability columns
    if (table === 'Operaciones_Captacion' || table === 'Operaciones_Liquidacion_P2P') {
      if (!columnNames.includes('transfer_bank_name')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_bank_name TEXT`);
      }
      if (!columnNames.includes('transfer_account_number')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_account_number TEXT`);
      }
      if (!columnNames.includes('transfer_payer_name')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_payer_name TEXT`);
      }
      if (!columnNames.includes('transfer_date')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_date TEXT`);
      }
      if (!columnNames.includes('transfer_tracking_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_tracking_id TEXT`);
      }
      if (!columnNames.includes('transfer_txid')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_txid TEXT`);
      }
      if (!columnNames.includes('transfer_receipt_url')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN transfer_receipt_url TEXT`);
      }
    }
  });

  // Migration for Liquidacion_Tickets
  const ticketColumns = db.prepare(`PRAGMA table_info(Liquidacion_Tickets)`).all();
  const ticketColumnNames = ticketColumns.map((c: any) => c.name);
  if (!ticketColumnNames.includes('customer_id')) {
    db.exec(`ALTER TABLE Liquidacion_Tickets ADD COLUMN customer_id TEXT`);
  }
  if (!ticketColumnNames.includes('transfer_receipt_url')) {
    db.exec(`ALTER TABLE Liquidacion_Tickets ADD COLUMN transfer_receipt_url TEXT`);
  }

  // Migration for Customers is_vip
  const customerColumns = db.prepare(`PRAGMA table_info(Customers)`).all();
  const customerColumnNames = customerColumns.map((c: any) => c.name);
  if (!customerColumnNames.includes('is_vip')) {
    db.exec(`ALTER TABLE Customers ADD COLUMN is_vip INTEGER DEFAULT 0`);
  }

  // Ensure Wallets table exists (redundant but safe for migrations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE,
      balance_mxn REAL DEFAULT 0,
      balance_usd REAL DEFAULT 0,
      balance_usdt REAL DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id)
    );
  `);

} catch (error) {
  console.error("Error creating tables or migrating:", error);
}

export default db;
