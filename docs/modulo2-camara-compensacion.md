# Módulo 2: Logística de Cámara de Compensación (Clearing House)

## Arquitectura de Base de Datos (PostgreSQL)
El esquema SQL se encuentra en `/db/schema.sql`.
Contiene dos tablas principales:
1. `Operaciones_Captacion`: Registra la entrada de recursos (efectivo/tarjeta) en el Nodo Origen (Sucursal A), vinculando el `erp_operation_id` (SOFTExchange) con el `blockchain_tx_hash` (On-ramp a USDT).
2. `Operaciones_Liquidacion_P2P`: Registra la salida de recursos en el Nodo Destino (Sucursal B), gestionando el Off-ramp (USDT a Fiat/Mastercard) y el estado de la liquidación física.

## Estructura de Carpetas Sugerida (Microservicio Node.js / TypeScript)

Para mantener la alta transaccionalidad y una arquitectura limpia (Clean Architecture), se sugiere la siguiente estructura para el microservicio:

```text
/src/microservices/clearing-house
├── config/                  # Configuración de entorno, DB (PostgreSQL), Redis y Web3
├── controllers/             # Controladores HTTP (REST API)
│   ├── captacion.controller.ts
│   └── liquidacion.controller.ts
├── middlewares/             # Autenticación mTLS, validación de schemas, manejo de errores
├── models/                  # Interfaces TypeScript y schemas de validación (Zod/Joi)
├── repositories/            # Capa de acceso a datos (PostgreSQL con TypeORM/Prisma)
│   ├── captacion.repository.ts
│   └── liquidacion.repository.ts
├── routes/                  # Definición de rutas Express/Fastify
├── services/                # Lógica de negocio core
│   ├── settlement.service.ts  # Algoritmo de liquidación virtual (Nodo A -> Nodo B)
│   ├── onramp.service.ts      # Lógica de conversión Efectivo -> USDT
│   └── offramp.service.ts     # Lógica de conversión USDT -> Fiat/Mastercard
├── utils/                   # Funciones utilitarias (formateo, cálculos de tasas)
├── web3/                    # Puerta de enlace Web3
│   ├── contracts/           # ABIs de Smart Contracts (USDT, Liquidity Pools)
│   └── provider.ts          # Configuración de Ethers.js / Web3.js
└── index.ts                 # Entry point del microservicio
```

## Algoritmo de Liquidación Virtual (Flujo Lógico)
1. **Captación (Nodo A):** El cliente entrega MXN en efectivo. El ERP SOFTExchange genera un `erp_operation_id`.
2. **On-ramp:** El microservicio recibe el webhook, bloquea la tasa en Redis, y ejecuta un Smart Contract para mintear/transferir USDT a la wallet concentradora. Se guarda el `blockchain_tx_hash` en `Operaciones_Captacion`.
3. **Enrutamiento:** El algoritmo de liquidación evalúa la liquidez de la Sucursal B (Nodo Destino) consultando el adaptador ODBC de SOFTExchange.
4. **Off-ramp (Nodo B):** El cliente se presenta en la Sucursal B o solicita retiro a tarjeta. El microservicio ejecuta el Off-ramp (USDT -> Fiat), genera un nuevo `blockchain_tx_hash` y actualiza `Operaciones_Liquidacion_P2P`.
5. **Conciliación:** Se notifica al ERP legado que la operación ha sido liquidada físicamente.
