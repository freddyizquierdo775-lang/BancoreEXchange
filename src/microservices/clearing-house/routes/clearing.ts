import express from "express";
import { kycValidator } from "../middlewares/kycValidator.ts";

const router = express.Router();

// Mock Captación (On-ramp) con Middleware de KYC
router.post("/captacion", kycValidator, (req, res) => {
  const { erp_operation_id, client_id, client_name, sucursal_origen_id, monto_fiat, moneda_fiat, metodo_captacion } = req.body;
  
  // Simulated On-ramp to USDT
  const tasa_cambio = 17.05;
  const monto_usdt = monto_fiat / tasa_cambio;
  const blockchain_tx_hash = "0x" + Math.random().toString(16).substring(2, 42);

  res.json({
    status: "success",
    message: "Captación registrada y On-ramp ejecutado",
    data: {
      id: "uuid-captacion-1234",
      erp_operation_id,
      client_id: client_id || "UNKNOWN",
      client_name: client_name || "Cliente Verificado",
      monto_usdt: monto_usdt.toFixed(6),
      blockchain_tx_hash,
      estado: "COMPLETADO"
    }
  });
});

// Mock Liquidación (Off-ramp)
router.post("/liquidacion", (req, res) => {
  const { captacion_id, sucursal_destino_id, metodo_liquidacion } = req.body;
  
  // Simulated Off-ramp from USDT to Fiat
  const monto_usdt = 1000;
  const tasa_cambio_liquidacion = 16.90;
  const monto_fiat_entregado = monto_usdt * tasa_cambio_liquidacion;
  const blockchain_tx_hash = "0x" + Math.random().toString(16).substring(2, 42);

  res.json({
    status: "success",
    message: "Liquidación registrada y Off-ramp ejecutado",
    data: {
      id: "uuid-liquidacion-5678",
      captacion_id,
      monto_fiat_entregado: monto_fiat_entregado.toFixed(2),
      moneda_fiat_entregada: "MXN",
      metodo_liquidacion,
      blockchain_tx_hash,
      estado: "LIQUIDADO"
    }
  });
});

export default router;
