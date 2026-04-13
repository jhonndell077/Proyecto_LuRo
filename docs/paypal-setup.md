# PayPal Setup

Esta integracion usa PayPal como proveedor de cobro para altas SaaS y cambios de membresia.

## Secrets requeridos

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_PLAN_BASICO`
- `PAYPAL_PLAN_PROFESIONAL`
- `PAYPAL_PLAN_EMPRESARIAL`
- `PAYPAL_WEBHOOK_ID`

Opcionales:

- `PAYPAL_PRODUCT_ID`
- `PAYPAL_MODE`

## URL del webhook

Produccion:

`https://us-central1-luro-control.cloudfunctions.net/paypalWebhook`

## Eventos recomendados

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.DENIED`
- `BILLING.SUBSCRIPTION.CANCELLED`

## Comandos utiles

```powershell
firebase functions:secrets:set PAYPAL_CLIENT_ID --project luro-control
firebase functions:secrets:set PAYPAL_CLIENT_SECRET --project luro-control
firebase functions:secrets:set PAYPAL_PLAN_BASICO --project luro-control
firebase functions:secrets:set PAYPAL_PLAN_PROFESIONAL --project luro-control
firebase functions:secrets:set PAYPAL_PLAN_EMPRESARIAL --project luro-control
firebase functions:secrets:set PAYPAL_WEBHOOK_ID --project luro-control
```

## Estado esperado

- `getPublicBillingConfig` debe devolver `subscriptionsReady: true`
- `paymentMode` debe quedar en `subscription_sdk`
- los `planIds` deben venir completos

Si `paymentMode` devuelve `paypal_link` o `unavailable`, faltan credenciales o planes.
