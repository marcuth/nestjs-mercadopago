import { DynamicModule, Global, Module, Provider } from "@nestjs/common"
import { DiscoveryModule } from "@nestjs/core"
import { MercadoPagoConfig } from "mercadopago"

import { MERCADOPAGO_CLIENT, MERCADOPAGO_OPTIONS } from "./mercadopago.constants"
import type { MercadoPagoModuleAsyncOptions, MercadoPagoModuleOptions } from "./mercadopago.interfaces"
import { MercadoPagoWebhookController } from "./webhook/webhook.controller"
import { MercadoPagoWebhookSignatureGuard } from "./webhook/webhook.guard"
import { MercadoPagoWebhookService } from "./webhook/webhook.service"

const clientProvider: Provider = {
    provide: MERCADOPAGO_CLIENT,
    inject: [MERCADOPAGO_OPTIONS],
    useFactory: (options: MercadoPagoModuleOptions) => new MercadoPagoConfig(options.config),
}

@Global()
@Module({})
export class MercadoPagoModule {
    static forRoot(options: MercadoPagoModuleOptions): DynamicModule {
        return this.build([{ provide: MERCADOPAGO_OPTIONS, useValue: options }], options.registerWebhookController)
    }

    static forRootAsync(options: MercadoPagoModuleAsyncOptions): DynamicModule {
        return this.build(
            [{ provide: MERCADOPAGO_OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] }],
            options.registerWebhookController,
            options.imports,
        )
    }

    private static build(
        optionsProviders: Provider[],
        registerController: boolean | undefined,
        imports: DynamicModule["imports"] = [],
    ): DynamicModule {
        return {
            module: MercadoPagoModule,
            imports: [DiscoveryModule, ...imports],
            controllers: registerController === false ? [] : [MercadoPagoWebhookController],
            providers: [
                ...optionsProviders,
                clientProvider,
                MercadoPagoWebhookService,
                MercadoPagoWebhookSignatureGuard,
            ],
            exports: [MERCADOPAGO_OPTIONS, MERCADOPAGO_CLIENT],
        }
    }
}
