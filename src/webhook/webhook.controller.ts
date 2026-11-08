import { BadRequestException, Body, Controller, HttpCode, Inject, Post, Query, UseGuards } from "@nestjs/common"

import type { MercadoPagoWebhookEvent } from "../mercadopago.interfaces"
import { MercadoPagoWebhookSignatureGuard } from "./webhook.guard"
import { MercadoPagoWebhookService } from "./webhook.service"

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value)

/**
 * Builds the event from the body, falling back to the query string for legacy
 * notifications (`?topic=payment&id=123`) that come without a body.
 */
function normalizeNotification(
    body: Partial<MercadoPagoWebhookEvent> | undefined,
    query: Record<string, unknown>,
): MercadoPagoWebhookEvent | undefined {
    const payload = body && typeof body === "object" ? body : {}
    const type = payload.type ?? first(query.type) ?? first(query.topic)
    const id = payload.data?.id ?? first(query["data.id"]) ?? first(query.id)

    if (typeof type !== "string" || !type || id === undefined || id === null || id === "") return undefined

    return { ...payload, type, data: { ...payload.data, id: String(id) } }
}

@Controller("mercadopago/webhook")
export class MercadoPagoWebhookController {
    constructor(@Inject(MercadoPagoWebhookService) private readonly service: MercadoPagoWebhookService) {}

    @Post()
    @HttpCode(200)
    @UseGuards(MercadoPagoWebhookSignatureGuard)
    async handle(@Body() body?: Partial<MercadoPagoWebhookEvent>, @Query() query: Record<string, unknown> = {}) {
        const event = normalizeNotification(body, query)

        if (!event) {
            throw new BadRequestException("Invalid notification payload")
        }

        // Errors thrown by handlers propagate as 500 so Mercado Pago retries the notification
        const handled = await this.service.dispatch(event, { query })
        return { received: true, handled }
    }
}
