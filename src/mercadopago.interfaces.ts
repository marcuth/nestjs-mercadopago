import type { ModuleMetadata, Type } from "@nestjs/common"
import type { MercadoPagoConfig } from "mercadopago"

export type MercadoPagoClientOptions = ConstructorParameters<typeof MercadoPagoConfig>[0]

export interface MercadoPagoModuleOptions {
    /** Access token and request options passed to the `MercadoPagoConfig` client. */
    config: MercadoPagoClientOptions
    /**
     * Secret used to validate the `x-signature` header of webhook notifications
     * (Mercado Pago dashboard > Your integrations > Webhooks).
     */
    webhookSecret?: string
    /**
     * Skips signature validation. Never enable in production.
     * @default false
     */
    skipWebhookSignatureValidation?: boolean
    /**
     * Maximum accepted difference, in seconds, between the signed timestamp and now.
     * Disabled when omitted.
     */
    webhookToleranceSeconds?: number
    /**
     * Registers the `POST /mercadopago/webhook` route.
     * @default true
     */
    registerWebhookController?: boolean
}

export interface MercadoPagoModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => MercadoPagoModuleOptions | Promise<MercadoPagoModuleOptions>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inject?: (Type<any> | string | symbol)[]
    /**
     * Must be known at module definition time since it decides whether the controller is registered.
     * @default true
     */
    registerWebhookController?: boolean
}

export interface MercadoPagoWebhookEvent {
    id?: number | string
    live_mode?: boolean
    type: string
    action?: string
    date_created?: string
    api_version?: string
    user_id?: number | string
    data: { id: string }
    [key: string]: unknown
}
