import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common"

import { MERCADOPAGO_OPTIONS } from "../mercadopago.constants"
import type { MercadoPagoModuleOptions } from "../mercadopago.interfaces"
import { validateWebhookSignature } from "./webhook-signature"

@Injectable()
export class MercadoPagoWebhookSignatureGuard implements CanActivate {
    constructor(@Inject(MERCADOPAGO_OPTIONS) private readonly options: MercadoPagoModuleOptions) {}

    canActivate(context: ExecutionContext): boolean {
        if (this.options.skipWebhookSignatureValidation) return true

        if (!this.options.webhookSecret) {
            throw new UnauthorizedException(
                "webhookSecret is not configured; set it or enable skipWebhookSignatureValidation",
            )
        }

        const request = context.switchToHttp().getRequest()
        const header = (name: string): string | undefined => {
            const value = request.headers?.[name]
            return Array.isArray(value) ? value[0] : value
        }
        const rawDataId = request.query?.["data.id"] ?? request.query?.data?.id ?? request.query?.id
        const dataId = Array.isArray(rawDataId) ? rawDataId[0] : rawDataId

        const valid = validateWebhookSignature({
            secret: this.options.webhookSecret,
            signatureHeader: header("x-signature"),
            requestId: header("x-request-id"),
            dataId: dataId === undefined ? undefined : String(dataId),
            toleranceSeconds: this.options.webhookToleranceSeconds,
        })

        if (!valid) throw new UnauthorizedException("Invalid webhook signature")
        return true
    }
}
