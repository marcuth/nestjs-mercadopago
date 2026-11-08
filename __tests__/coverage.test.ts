import "reflect-metadata"

import { ExecutionContext, Injectable, Module, UnauthorizedException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { MercadoPagoConfig } from "mercadopago"
import { describe, expect, it, vi } from "vitest"

import {
    InjectMercadoPago,
    MERCADOPAGO_OPTIONS,
    MercadoPagoModule,
    MercadoPagoWebhookController,
    MercadoPagoWebhookHandler,
    MercadoPagoWebhookService,
    MercadoPagoWebhookSignatureGuard,
    parseSignatureHeader,
    validateWebhookSignature,
} from "../src"

function contextFor(request: unknown): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext
}

describe("signature helpers", () => {
    it("ignores malformed header parts", () => {
        expect(parseSignatureHeader("garbage,ts=1,v1=abc")).toEqual({ ts: "1", v1: "abc" })
    })

    it("rejects headers missing ts or v1", () => {
        expect(validateWebhookSignature({ secret: "s", signatureHeader: "ts=1" })).toBe(false)
        expect(validateWebhookSignature({ secret: "s", signatureHeader: "v1=abc" })).toBe(false)
    })

    it("handles tolerance with second timestamps and invalid timestamps", () => {
        const base = { secret: "s", signatureHeader: "", dataId: "1" }
        expect(validateWebhookSignature({ ...base, signatureHeader: "ts=abc,v1=x", toleranceSeconds: 10 })).toBe(false)
        expect(
            validateWebhookSignature({
                ...base,
                signatureHeader: "ts=1000,v1=x",
                toleranceSeconds: 10,
                now: 1_000_000,
            }),
        ).toBe(false)
        // within tolerance (seconds) but wrong hash
        expect(
            validateWebhookSignature({
                ...base,
                signatureHeader: "ts=1000,v1=x",
                toleranceSeconds: 10,
                now: 1_000_000 + 5_000,
            }),
        ).toBe(false)
    })

    it("builds the manifest without optional parts and keeps non-alphanumeric ids", async () => {
        const { createHmac } = await import("node:crypto")
        const hash = (manifest: string) => createHmac("sha256", "s").update(manifest).digest("hex")

        expect(validateWebhookSignature({ secret: "s", signatureHeader: `ts=5,v1=${hash("ts:5;")}` })).toBe(true)
        expect(
            validateWebhookSignature({
                secret: "s",
                signatureHeader: `ts=5,v1=${hash("id:A-b;request-id:r;ts:5;")}`,
                dataId: "A-b",
                requestId: "r",
            }),
        ).toBe(true)
    })
})

describe("MercadoPagoWebhookSignatureGuard", () => {
    const guard = (options: object) => new MercadoPagoWebhookSignatureGuard(options as never)

    it("skips validation when configured", () => {
        expect(guard({ skipWebhookSignatureValidation: true }).canActivate(contextFor({}))).toBe(true)
    })

    it("rejects when no secret is configured", () => {
        expect(() => guard({}).canActivate(contextFor({}))).toThrow(UnauthorizedException)
    })

    it("reads array headers and alternative query shapes", () => {
        const g = guard({ webhookSecret: "s" })
        const request = {
            headers: { "x-signature": ["ts=1,v1=x"], "x-request-id": ["r"] },
            query: { data: { id: 123 } },
        }
        expect(() => g.canActivate(contextFor(request))).toThrow(UnauthorizedException)
        expect(() => g.canActivate(contextFor({ headers: {}, query: { "data.id": ["1", "2"] } }))).toThrow(
            UnauthorizedException,
        )
        expect(() => g.canActivate(contextFor({}))).toThrow(UnauthorizedException)
    })
})

describe("MercadoPagoWebhookController", () => {
    it("rejects invalid payloads", async () => {
        const controller = new MercadoPagoWebhookController({ dispatch: vi.fn() } as never)
        await expect(controller.handle(undefined as never)).rejects.toThrow("Invalid notification payload")
        await expect(controller.handle({} as never)).rejects.toThrow("Invalid notification payload")
    })
})

describe("MercadoPagoWebhookService", () => {
    it("ignores providers without instances and non-function members", () => {
        const service = new MercadoPagoWebhookService(
            { getProviders: () => [{ instance: null }, { instance: "str" }, { instance: { a: 1 } }] } as never,
            { getAllMethodNames: () => ["a"] } as never,
        )
        service.onModuleInit()
    })
})

describe("MercadoPagoModule", () => {
    @Injectable()
    class Consumer {
        constructor(@InjectMercadoPago() readonly client: MercadoPagoConfig) {}

        @MercadoPagoWebhookHandler("payment")
        noop() {}
    }

    it("supports forRootAsync, injects the client and can skip the controller", async () => {
        @Module({ providers: [{ provide: "TOKEN", useValue: "TEST-token" }], exports: ["TOKEN"] })
        class ConfigModule {}

        const moduleRef = await Test.createTestingModule({
            imports: [
                MercadoPagoModule.forRootAsync({
                    imports: [ConfigModule],
                    inject: ["TOKEN"],
                    useFactory: (accessToken: string) => ({ config: { accessToken } }),
                    registerWebhookController: false,
                }),
            ],
            providers: [Consumer],
        }).compile()
        await moduleRef.init()

        expect(moduleRef.get(Consumer).client).toBeInstanceOf(MercadoPagoConfig)
        expect(moduleRef.get(MERCADOPAGO_OPTIONS)).toEqual({ config: { accessToken: "TEST-token" } })
        expect(() => moduleRef.get(MercadoPagoWebhookController)).toThrow()
    })

    it("works without inject or imports in forRootAsync", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [MercadoPagoModule.forRootAsync({ useFactory: () => ({ config: { accessToken: "t" } }) })],
        }).compile()
        expect(moduleRef.get(MercadoPagoWebhookController)).toBeDefined()
    })
})
