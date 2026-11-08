import { Inject, SetMetadata } from "@nestjs/common"

import { MERCADOPAGO_CLIENT, MERCADOPAGO_WEBHOOK_HANDLER } from "./mercadopago.constants"

/** Injects the `MercadoPagoConfig` client. */
export const InjectMercadoPago = () => Inject(MERCADOPAGO_CLIENT)

export interface MercadoPagoWebhookHandlerMetadata {
    /** Notification `type` (e.g. `payment`, `subscription_preapproval`) or `*`. */
    type: string
    /** Optional notification `action` (e.g. `payment.created`). */
    action?: string
}

/**
 * Marks a provider method as a handler for webhook notifications.
 * The method receives the notification as its first argument and the request context
 * (`{ query }`, with params like `?source=invoice` from your `notification_url`) as the second.
 * Legacy notifications (`?topic=payment&id=123`) are normalized to `{ type, data: { id } }`.
 *
 * @example
 * ```ts
 * @MercadoPagoWebhookHandler("payment", "payment.updated")
 * async onPayment(event: MercadoPagoWebhookEvent) {}
 * ```
 */
export const MercadoPagoWebhookHandler = (type: string, action?: string) =>
    SetMetadata<string, MercadoPagoWebhookHandlerMetadata>(MERCADOPAGO_WEBHOOK_HANDLER, { type, action })
