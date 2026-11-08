import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { DiscoveryService, MetadataScanner } from "@nestjs/core"

import { MERCADOPAGO_WEBHOOK_HANDLER } from "../mercadopago.constants"
import type { MercadoPagoWebhookHandlerMetadata } from "../mercadopago.decorators"
import type { MercadoPagoWebhookContext, MercadoPagoWebhookEvent } from "../mercadopago.interfaces"

interface RegisteredHandler extends MercadoPagoWebhookHandlerMetadata {
    call: (event: MercadoPagoWebhookEvent, context: MercadoPagoWebhookContext) => unknown
}

@Injectable()
export class MercadoPagoWebhookService implements OnModuleInit {
    private readonly logger = new Logger(MercadoPagoWebhookService.name)
    private handlers: RegisteredHandler[] = []

    constructor(
        @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
        @Inject(MetadataScanner) private readonly metadataScanner: MetadataScanner,
    ) {}

    onModuleInit() {
        const handlers: RegisteredHandler[] = []

        for (const wrapper of this.discovery.getProviders()) {
            const { instance } = wrapper
            if (!instance || typeof instance !== "object") continue

            const prototype = Object.getPrototypeOf(instance)
            for (const name of this.metadataScanner.getAllMethodNames(prototype)) {
                const method = instance[name]
                if (typeof method !== "function") continue

                const metadata: MercadoPagoWebhookHandlerMetadata | undefined = Reflect.getMetadata(
                    MERCADOPAGO_WEBHOOK_HANDLER,
                    method,
                )
                if (!metadata) continue

                handlers.push({ ...metadata, call: method.bind(instance) })
                this.logger.log(
                    `Registered webhook handler ${instance.constructor.name}.${name} for ${metadata.type}${metadata.action ? `:${metadata.action}` : ""}`,
                )
            }
        }

        this.handlers = handlers
    }

    async dispatch(
        event: MercadoPagoWebhookEvent,
        context: MercadoPagoWebhookContext = { query: {} },
    ): Promise<number> {
        const matching = this.handlers.filter(
            (handler) =>
                (handler.type === "*" || handler.type === event.type) &&
                (!handler.action || handler.action === event.action),
        )

        await Promise.all(matching.map((handler) => handler.call(event, context)))
        return matching.length
    }
}
