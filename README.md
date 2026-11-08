# nestjs-mercadopago

[![npm](https://img.shields.io/npm/v/nestjs-mercadopago)](https://www.npmjs.com/package/nestjs-mercadopago)
[![license](https://img.shields.io/npm/l/nestjs-mercadopago)](./LICENSE)

A [NestJS](https://nestjs.com) module for [Mercado Pago](https://www.mercadopago.com). It gives you an injectable
`MercadoPagoConfig` client, a ready-to-use webhook route with signature validation, and a decorator to handle
notifications declaratively.

- Injectable Mercado Pago client (`@InjectMercadoPago()`)
- `POST /mercadopago/webhook` route out of the box
- HMAC-SHA256 validation of the `x-signature` header (with optional timestamp tolerance)
- `@MercadoPagoWebhookHandler()` decorator discovered automatically on any provider
- `forRoot` and `forRootAsync` configuration

## Installation

```bash
npm install nestjs-mercadopago mercadopago @nestjs/common @nestjs/core reflect-metadata rxjs
```

Requires Node.js >= 18 and NestJS 11 or 12.

## Setup

```ts
import { Module } from "@nestjs/common"
import { MercadoPagoModule } from "nestjs-mercadopago"

@Module({
    imports: [
        MercadoPagoModule.forRoot({
            config: { accessToken: process.env.MP_ACCESS_TOKEN! },
            webhookSecret: process.env.MP_WEBHOOK_SECRET,
        }),
    ],
})
export class AppModule {}
```

Async configuration:

```ts
MercadoPagoModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        config: { accessToken: config.getOrThrow("MP_ACCESS_TOKEN") },
        webhookSecret: config.getOrThrow("MP_WEBHOOK_SECRET"),
    }),
})
```

The module is global, so the client and options are available everywhere.

### Options

| Option                           | Description                                                                                      | Default |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| `config`                         | Passed to `new MercadoPagoConfig(...)` (`accessToken`, `options`).                               | —       |
| `webhookSecret`                  | Secret from _Your integrations > Webhooks_ used to validate `x-signature`.                       | —       |
| `skipWebhookSignatureValidation` | Disables signature validation. **Never use in production.**                                      | `false` |
| `webhookToleranceSeconds`        | Rejects notifications whose signed timestamp differs from now by more than this many seconds.    | off     |
| `registerWebhookController`      | Registers the `POST /mercadopago/webhook` route. Set to `false` to provide your own controller.  | `true`  |

## Using the client

```ts
import { Injectable } from "@nestjs/common"
import { MercadoPagoConfig, Payment } from "mercadopago"
import { InjectMercadoPago } from "nestjs-mercadopago"

@Injectable()
export class PaymentsService {
    private readonly payment: Payment

    constructor(@InjectMercadoPago() client: MercadoPagoConfig) {
        this.payment = new Payment(client)
    }

    get(id: string) {
        return this.payment.get({ id })
    }
}
```

## Webhooks

Point your Mercado Pago notification URL to `https://your-domain/mercadopago/webhook`, then declare handlers on any
provider:

```ts
import { Injectable } from "@nestjs/common"
import { MercadoPagoWebhookEvent, MercadoPagoWebhookHandler } from "nestjs-mercadopago"

@Injectable()
export class PaymentsWebhook {
    // type + action
    @MercadoPagoWebhookHandler("payment", "payment.updated")
    async onPaymentUpdated(event: MercadoPagoWebhookEvent) {
        console.log("payment", event.data.id)
    }

    // every payment notification
    @MercadoPagoWebhookHandler("payment")
    async onPayment(event: MercadoPagoWebhookEvent) {}

    // everything
    @MercadoPagoWebhookHandler("*")
    async onAny(event: MercadoPagoWebhookEvent) {}
}
```

Behavior:

- Invalid or missing signatures get `401`; malformed payloads get `400`.
- Valid notifications get `200` with `{ "received": true, "handled": <number of handlers> }`.
- If a handler throws, the route answers `500` so Mercado Pago retries the notification. Make handlers idempotent.
- The notification only carries the resource id: fetch the full resource with the client (e.g. `payment.get`).
- Without `webhookSecret` (and without `skipWebhookSignatureValidation`) every request is rejected.

The signature helpers are exported too, if you need them elsewhere:

```ts
import { validateWebhookSignature } from "nestjs-mercadopago"
```

## Development

```bash
npm run format      # prettier
npm run lint:fix    # eslint --fix
npm test            # vitest
npm run test:cov    # coverage
npm run build       # tsc
```

The CI workflow runs format and `lint:fix`, commits any resulting changes as `github-actions[bot]`, then builds and
tests.

## License

MIT © Marcuth
