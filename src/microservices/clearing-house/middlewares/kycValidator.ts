import { Request, Response, NextFunction } from 'express';

// Tasas de cambio simuladas para la validación (En producción vendrían de Redis)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  MXN: 17.05,
  EUR: 0.92
};

export const kycValidator = (req: Request, res: Response, next: NextFunction): void => {
  const { monto_fiat, moneda_fiat, client_data, clave_autorizacion } = req.body;

  if (!monto_fiat || !moneda_fiat) {
    res.status(400).json({ 
      status: "error",
      error: "Los campos 'monto_fiat' y 'moneda_fiat' son obligatorios." 
    });
    return;
  }

  const rate = EXCHANGE_RATES[moneda_fiat.toUpperCase()];
  if (!rate) {
    res.status(400).json({ 
      status: "error",
      error: `Moneda no soportada: ${moneda_fiat}` 
    });
    return;
  }

  // Convertir el monto a USD para evaluar los umbrales operativos
  const monto_usd = moneda_fiat.toUpperCase() === 'USD' ? monto_fiat : monto_fiat / rate;

  // Regla 1: Montos inferiores a $1,000 USD
  if (monto_usd < 1000) {
    // Si no hay cliente especificado, se registra como Público en General
    if (!req.body.client_id && (!client_data || !client_data.nombre)) {
      req.body.client_name = 'Público en General';
      req.body.client_id = 'PUBLICO_GENERAL';
    }
    return next();
  }

  // Regla 2: Monto >= $1,000 USD y < $3,000 USD
  if (monto_usd >= 1000 && monto_usd < 3000) {
    if (!client_data || !client_data.identificacion) {
      res.status(403).json({
        status: "blocked",
        code: "KYC_LEVEL_1_REQUIRED",
        error: "Operación bloqueada: Para montos entre $1,000 y $3,000 USD se requieren datos de identificación del usuario."
      });
      return;
    }
    return next();
  }

  // Regla 3: Monto >= $3,000 USD y < $5,000 USD
  if (monto_usd >= 3000 && monto_usd < 5000) {
    if (!client_data || !client_data.identificacion || !client_data.comprobante_domicilio) {
      res.status(403).json({
        status: "blocked",
        code: "KYC_LEVEL_2_REQUIRED",
        error: "Operación bloqueada: Para montos entre $3,000 y $5,000 USD se exige copia escaneada de Identificación y Comprobante de Domicilio."
      });
      return;
    }
    return next();
  }

  // Regla 4: Monto >= $5,000 USD y <= $10,000 USD
  if (monto_usd >= 5000 && monto_usd <= 10000) {
    if (!client_data || !client_data.identificacion || !client_data.comprobante_domicilio || !client_data.firma_expediente || !client_data.ocupacion) {
      res.status(403).json({
        status: "blocked",
        code: "KYC_LEVEL_3_REQUIRED",
        error: "Operación bloqueada: Faltan datos del expediente (firma, datos de ocupación/giro, identificación o comprobante de domicilio)."
      });
      return;
    }

    // Protocolo de Operaciones Supervisadas
    if (!clave_autorizacion || clave_autorizacion.length !== 9) {
      res.status(403).json({
        status: "blocked",
        code: "SUPERVISED_OPERATION_PROTOCOL",
        error: "Protocolo de Operaciones Supervisadas: Se requiere una clave de autorización válida de exactamente 9 caracteres."
      });
      return;
    }
    return next();
  }

  // Regla 5: Monto > $10,000 USD (Límite superior implícito de seguridad)
  if (monto_usd > 10000) {
    res.status(403).json({
      status: "blocked",
      code: "AMOUNT_LIMIT_EXCEEDED",
      error: "Operación bloqueada: El monto excede el límite operativo máximo permitido de $10,000 USD por transacción."
    });
    return;
  }

  next();
};
