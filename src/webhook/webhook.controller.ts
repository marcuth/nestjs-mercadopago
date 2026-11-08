import { BadRequestException, Body, Controller, HttpCode, Inject, Post, UseGuards } from "@nestjs/common"

import type { MercadoPagoWebhookEvent } from "../mercadopago.interfaces"
import { MercadoPagoWebhookSignatureGuard } from "./webhook.guard"
import { MercadoPagoWebhookService } from "./webhook.service"

@Controller("mercadopago/webhook")
export class MercadoPagoWebhookController {
    constructor(@Inject(MercadoPagoWebhookService) private readonly service: MercadoPagoWebhookService) {}

    @Post()
    @HttpCode(200)
    @UseGuards(MercadoPagoWebhookSignatureGuard)
    async handle(@Body() body: MercadoPagoWebhookEvent) {
        if (!body || typeof body !== "object" || !body.type) {
            throw new BadRequestException("Invalid notification payload")
        }

        // Errors thrown by handlers propagate as 500 so Mercado Pago retries the notification
        const handled = await this.service.dispatch(body)
        return { received: true, handled }
    }
}
