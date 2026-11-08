import "reflect-metadata"

import { createHmac } from "node:crypto"

import { INestApplication, Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MercadoPagoModule, MercadoPagoWebhookEvent, MercadoPagoWebhookHandler, validateWebhookSignature } from "../src"

const secret = "test-secret"

function sign(dataId: string, requestId: string, ts = String(Date.now())) {
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
    return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`
}

describe("validateWebhookSignature", () => {
    it("accepts a valid signature", () => {
        expect(
            validateWebhookSignature({
                secret,
                signatureHeader: sign("ABC123", "req-1"),
                requestId: "req-1",
                dataId: "ABC123",
            }),
        ).toBe(true)
    })

    it("rejects tampered data, missing header and stale timestamps", () => {
        const header = sign("123", "req-1")
        expect(validateWebhookSignature({ secret, signatureHeader: header, requestId: "req-1", dataId: "999" })).toBe(
            false,
        )
        expect(validateWebhookSignature({ secret, requestId: "req-1", dataId: "123" })).toBe(false)
        const old = sign("123", "req-1", String(Date.now() - 3_600_000))
        expect(
            validateWebhookSignature({
                secret,
                signatureHeader: old,
                requestId: "req-1",
                dataId: "123",
                toleranceSeconds: 300,
            }),
        ).toBe(false)
    })
})

describe("POST /mercadopago/webhook", () => {
    const onPayment = vi.fn()
    const onAny = vi.fn()
    let app: INestApplication

    @Injectable()
    class Handlers {
        @MercadoPagoWebhookHandler("payment", "payment.created")
        payment(event: MercadoPagoWebhookEvent) {
            onPayment(event)
        }

        @MercadoPagoWebhookHandler("*")
        any(event: MercadoPagoWebhookEvent) {
            onAny(event)
        }
    }

    beforeEach(async () => {
        onPayment.mockClear()
        onAny.mockClear()
        const moduleRef = await Test.createTestingModule({
            imports: [MercadoPagoModule.forRoot({ config: { accessToken: "TEST-token" }, webhookSecret: secret })],
            providers: [Handlers],
        }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
    })

    afterEach(() => app.close())

    const body = { type: "payment", action: "payment.created", data: { id: "123" } }

    it("dispatches a signed notification to matching handlers", async () => {
        const res = await request(app.getHttpServer())
            .post("/mercadopago/webhook?data.id=123")
            .set("x-request-id", "req-1")
            .set("x-signature", sign("123", "req-1"))
            .send(body)
            .expect(200)

        expect(res.body).toEqual({ received: true, handled: 2 })
        expect(onPayment).toHaveBeenCalledWith(body)
        expect(onAny).toHaveBeenCalledOnce()
    })

    it("does not call action-specific handlers for other actions", async () => {
        await request(app.getHttpServer())
            .post("/mercadopago/webhook?data.id=123")
            .set("x-request-id", "req-1")
            .set("x-signature", sign("123", "req-1"))
            .send({ ...body, action: "payment.updated" })
            .expect(200)

        expect(onPayment).not.toHaveBeenCalled()
        expect(onAny).toHaveBeenCalledOnce()
    })

    it("rejects invalid signatures with 401", async () => {
        await request(app.getHttpServer())
            .post("/mercadopago/webhook?data.id=123")
            .set("x-request-id", "req-1")
            .set("x-signature", "ts=1,v1=deadbeef")
            .send(body)
            .expect(401)

        expect(onAny).not.toHaveBeenCalled()
    })
})
