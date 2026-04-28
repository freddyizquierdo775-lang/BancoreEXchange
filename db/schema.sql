-- Módulo 2: Logística de Cámara de Compensación (Clearing House)
-- Base de Datos: PostgreSQL Core ERP

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla para registrar la captación de recursos en el Nodo Origen (Sucursal A)
CREATE TABLE Operaciones_Captacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    erp_operation_id VARCHAR(50) NOT NULL UNIQUE, -- ID del ERP legado (SOFTExchange)
    client_id VARCHAR(50) NOT NULL,
    sucursal_origen_id VARCHAR(50) NOT NULL,
    monto_fiat NUMERIC(18, 4) NOT NULL,
    moneda_fiat VARCHAR(3) NOT NULL, -- MXN, USD, EUR
    metodo_captacion VARCHAR(20) NOT NULL, -- EFECTIVO, TARJETA, TRANSFERENCIA
    tasa_cambio NUMERIC(18, 6) NOT NULL,
    monto_usdt NUMERIC(18, 6) NOT NULL, -- Equivalente en USDT (On-ramp)
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, COMPLETADO, FALLIDO
    blockchain_tx_hash VARCHAR(100), -- Hash de la transacción On-ramp
    wallet_origen VARCHAR(100),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para registrar la liquidación física en el Nodo Destino (Sucursal B)
CREATE TABLE Operaciones_Liquidacion_P2P (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    captacion_id UUID NOT NULL REFERENCES Operaciones_Captacion(id),
    sucursal_destino_id VARCHAR(50) NOT NULL,
    monto_usdt NUMERIC(18, 6) NOT NULL,
    tasa_cambio_liquidacion NUMERIC(18, 6) NOT NULL,
    monto_fiat_entregado NUMERIC(18, 4) NOT NULL,
    moneda_fiat_entregada VARCHAR(3) NOT NULL,
    metodo_liquidacion VARCHAR(20) NOT NULL, -- EFECTIVO, TARJETA_MASTERCARD
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN_PROCESO, LIQUIDADO
    blockchain_tx_hash VARCHAR(100), -- Hash de la transacción Off-ramp
    boveda_destino_id VARCHAR(50),
    liquidado_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_captacion_erp_id ON Operaciones_Captacion(erp_operation_id);
CREATE INDEX idx_captacion_estado ON Operaciones_Captacion(estado);
CREATE INDEX idx_liquidacion_estado ON Operaciones_Liquidacion_P2P(estado);
CREATE INDEX idx_captacion_tx_hash ON Operaciones_Captacion(blockchain_tx_hash);
CREATE INDEX idx_liquidacion_tx_hash ON Operaciones_Liquidacion_P2P(blockchain_tx_hash);
