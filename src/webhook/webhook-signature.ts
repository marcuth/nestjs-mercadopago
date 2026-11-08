import { createHmac, timingSafeEqual } from "node:crypto"

export interface ValidateSignatureParams {
    secret: string
    signatureHeader?: string
    requestId?: string
    dataId?: string
    toleranceSeconds?: number
    now?: number
}

export function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
    const result: Record<string, string> = {}
    for (const part of header.split(",")) {
        const index = part.indexOf("=")
        if (index === -1) continue
        result[part.slice(0, index).trim()] = part.slice(index + 1).trim()
    }
    return result
}

export function validateWebhookSignature(params: ValidateSignatureParams): boolean {
    const { secret, signatureHeader, requestId, dataId, toleranceSeconds, now = Date.now() } = params
    if (!signatureHeader) return false

    const { ts, v1 } = parseSignatureHeader(signatureHeader)
    if (!ts || !v1) return false

    if (toleranceSeconds !== undefined) {
        // `ts` is in milliseconds for current notifications, seconds for older ones
        const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts)
        if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > toleranceSeconds * 1000) return false
    }

    // Mercado Pago lowercases alphanumeric ids before signing
    const id = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId

    let manifest = ""
    if (id) manifest += `id:${id};`
    if (requestId) manifest += `request-id:${requestId};`
    manifest += `ts:${ts};`

    const expected = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"))
    const received = Buffer.from(v1)
    return expected.length === received.length && timingSafeEqual(expected, received)
}
