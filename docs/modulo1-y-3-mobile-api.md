# Módulos 1 y 3: Global Liquidity Hub & Analítica de Spread (App Móvil)

## Estructura de Código Sugerida (React Native / Flutter)

Para la aplicación móvil del franquiciatario, se sugiere una arquitectura basada en **Features** (Feature-Sliced Design) o **Clean Architecture** adaptada a frontend:

```text
/src
├── core/                  # Configuración global, temas, constantes
├── data/                  # Capa de datos
│   ├── api/               # Clientes HTTP (Axios/Dio) interceptores mTLS
│   ├── models/            # Modelos de datos (Interfaces TypeScript / Clases Dart)
│   └── repositories/      # Implementación de repositorios
├── domain/                # Capa de dominio (Casos de uso)
│   ├── usecases/          # Ej: AuthorizeClearingRequestUseCase, GetSpreadAnalyticsUseCase
│   └── entities/          # Entidades de negocio puras
├── presentation/          # Capa de UI
│   ├── common/            # Componentes compartidos (Botones, Inputs, Layouts)
│   ├── features/          # Módulos principales
│   │   ├── liquidity_hub/ # Módulo 1
│   │   │   ├── screens/   # PortfolioScreen, PendingRequestsScreen
│   │   │   └── widgets/   # PortfolioPieChart, RequestCard, BiometricAuthModal
│   │   └── analytics/     # Módulo 3
│   │       ├── screens/   # SpreadAnalyticsScreen
│   │       └── widgets/   # SpreadChart, FifoMarginTable
│   └── navigation/        # Configuración de rutas (React Navigation / GoRouter)
└── utils/                 # Helpers (Formateo de moneda, fechas, biometría)
```

## Modelos de Datos JSON (Respuestas de la API)

### 1. Global Liquidity Hub - Portafolio Total
**Endpoint:** `GET /api/liquidity/portfolio`
**Descripción:** Devuelve el valor total del portafolio consolidado (Fiat en bóvedas + USDT en wallets) para graficar en un Pie Chart.

```json
{
  "status": "success",
  "data": {
    "total_value_usd": 1250000.00,
    "last_updated": "2026-03-01T20:30:00Z",
    "assets": [
      {
        "asset_id": "USD_CASH",
        "name": "Dólares Físicos",
        "type": "FIAT",
        "balance": 450000.00,
        "value_usd": 450000.00,
        "percentage": 36.0,
        "color_hex": "#10B981"
      },
      {
        "asset_id": "MXN_CASH",
        "name": "Pesos Físicos",
        "type": "FIAT",
        "balance": 8500000.00,
        "value_usd": 500000.00,
        "percentage": 40.0,
        "color_hex": "#3B82F6"
      },
      {
        "asset_id": "USDT_ONCHAIN",
        "name": "Tether (USDT)",
        "type": "CRYPTO",
        "balance": 300000.00,
        "value_usd": 300000.00,
        "percentage": 24.0,
        "color_hex": "#F59E0B"
      }
    ]
  }
}
```

### 2. Cámara de Compensación - Partidas Pendientes (Autorización Biométrica)
**Endpoint:** `GET /api/clearing-house/pending-requests`
**Descripción:** Lista de deudas/créditos virtuales entre sucursales que requieren autorización del franquiciatario.

```json
{
  "status": "success",
  "data": {
    "pending_requests": [
      {
        "request_id": "REQ-8829-A",
        "type": "VIRTUAL_CREDIT",
        "source_branch": "Sucursal Polanco (A)",
        "target_branch": "Sucursal Santa Fe (B)",
        "amount_usdt": 50000.00,
        "equivalent_fiat": 850000.00,
        "currency_fiat": "MXN",
        "status": "PENDING_AUTHORIZATION",
        "created_at": "2026-03-01T19:45:00Z",
        "requires_biometric": true,
        "risk_flag": "LOW"
      }
    ]
  }
}
```

### 3. Analítica de Spread (Metodología FIFO)
**Endpoint:** `GET /api/analytics/spread`
**Descripción:** Cruza el tipo de cambio internacional, el de ventanilla y el de liquidación P2P, calculando el margen bruto usando primeras entradas, primeras salidas (FIFO).

```json
{
  "status": "success",
  "data": {
    "currency_pair": "USD/MXN",
    "current_rates": {
      "mid_market_international": 17.05,
      "window_buy_rate": 16.80,
      "p2p_settlement_rate": 17.15
    },
    "fifo_margin_analysis": {
      "period": "24h",
      "total_volume_sold_usd": 10000.00,
      "average_buy_cost_fifo": 16.75,
      "average_sell_price": 17.15,
      "gross_margin_mxn": 4000.00,
      "gross_margin_percentage": 2.38
    },
    "historical_spread_chart": [
      {
        "timestamp": "2026-03-01T10:00:00Z",
        "mid_market": 17.02,
        "window_buy": 16.78,
        "p2p_settlement": 17.12,
        "fifo_margin_pct": 2.02
      },
      {
        "timestamp": "2026-03-01T14:00:00Z",
        "mid_market": 17.05,
        "window_buy": 16.80,
        "p2p_settlement": 17.15,
        "fifo_margin_pct": 2.08
      }
    ]
  }
}
```
