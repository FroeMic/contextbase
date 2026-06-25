import {
  CaptureClientPairBodySchema,
  type SessionCaptureManualSyncBody,
  SessionCaptureManualSyncBodySchema,
} from "@contextbase/contracts"
import { createDbClient, type DbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
  requireAuthenticatedScope,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresSessionCaptureStore } from "@contextbase/core/domains/session-capture/repository"
import {
  authenticateCaptureClient,
  createWorkspaceCaptureClient,
  ingestManualSyncBatch,
  type ManualSyncBatchInput,
  type SessionCaptureStore,
} from "@contextbase/core/domains/session-capture/service"
import {
  type AppError,
  AuthenticationError,
  InternalError,
  InvalidRequestError,
  mapAppErrorToHttp,
} from "@contextbase/core/shared/errors"
import { successEnvelope } from "@contextbase/core/shared/response"
import { Effect, Either, Schema } from "effect"
import type { Context } from "hono"
import { Hono } from "hono"

export type SessionCaptureRouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  dbClient?: DbClient
  sessionCaptureStore?: SessionCaptureStore
}

export function createSessionCaptureRouter(dependencies: SessionCaptureRouteDependencies = {}) {
  const app = new Hono()

  app.post("/api/v1/session-capture/clients", async (context) => {
    const auth = await authenticateApiRequest(context.req.raw, dependencies, "contextbase:manage")
    if (!auth.ok) return writeAppError(context, auth.error)

    const body = await decodeJsonBody(context, CaptureClientPairBodySchema)
    if (!body.ok) return writeAppError(context, body.error)

    return withSessionCaptureStore(dependencies, async (store) => {
      const result = await Effect.runPromise(
        Effect.either(createWorkspaceCaptureClient(store, auth.data, body.data)),
      )

      if (Either.isLeft(result)) return writeAppError(context, result.left)
      return context.json(successEnvelope(result.right), 201, noStoreHeaders())
    })
  })

  app.post("/api/v1/session-capture/sync/manual", async (context) => {
    const token = extractBearerToken(context.req.raw)
    if (!token) {
      return writeAppError(
        context,
        new AuthenticationError({
          code: "unauthenticated",
          message: "Missing capture client token",
        }),
      )
    }

    const body = await decodeJsonBody(context, SessionCaptureManualSyncBodySchema)
    if (!body.ok) return writeAppError(context, body.error)

    return withSessionCaptureStore(dependencies, async (store) => {
      const auth = await Effect.runPromise(Effect.either(authenticateCaptureClient(store, token)))
      if (Either.isLeft(auth)) return writeAppError(context, auth.left)

      const result = await Effect.runPromise(
        Effect.either(ingestManualSyncBatch(store, auth.right, toManualSyncInput(body.data))),
      )
      if (Either.isLeft(result)) return writeAppError(context, result.left)

      return context.json(successEnvelope(result.right), 200, noStoreHeaders())
    })
  })

  return app
}

async function authenticateApiRequest(
  request: Request,
  dependencies: SessionCaptureRouteDependencies,
  requiredScope: Parameters<typeof requireAuthenticatedScope>[1],
): Promise<{ data: AuthenticatedContext; ok: true } | { error: AppError; ok: false }> {
  const token = extractBearerToken(request)
  if (!token) {
    return {
      error: new AuthenticationError({
        code: "unauthenticated",
        message: "Missing API token",
      }),
      ok: false,
    }
  }

  try {
    const auth = dependencies.authenticateApiToken
      ? await dependencies.authenticateApiToken(token)
      : await authenticateWithDatabaseToken(token, dependencies.dbClient)
    const scopeError = requireAuthenticatedScope(auth, requiredScope)
    if (scopeError) throw scopeError
    return { data: auth, ok: true }
  } catch (error) {
    return { error: normalizeRouteError(error), ok: false }
  }
}

async function authenticateWithDatabaseToken(token: string, dbClient?: DbClient) {
  const client = dbClient ?? createDbClient()
  try {
    return await Effect.runPromise(authenticateBearerToken(client, token))
  } finally {
    if (!dbClient) await client.end()
  }
}

async function withSessionCaptureStore<T>(
  dependencies: SessionCaptureRouteDependencies,
  fn: (store: SessionCaptureStore) => Promise<T>,
) {
  if (dependencies.sessionCaptureStore) return fn(dependencies.sessionCaptureStore)
  if (dependencies.dbClient) return fn(createPostgresSessionCaptureStore(dependencies.dbClient))

  const client = createDbClient()
  try {
    return await fn(createPostgresSessionCaptureStore(client))
  } finally {
    await client.end()
  }
}

async function decodeJsonBody<T, I>(context: Context, schema: Schema.Schema<T, I, never>) {
  let rawBody: unknown
  try {
    rawBody = await context.req.json()
  } catch (error) {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: { cause: String(error) },
        message: "Malformed JSON request body",
      }),
      ok: false as const,
    }
  }

  const decoded = Schema.decodeUnknownEither(schema)(rawBody)
  if (Either.isLeft(decoded)) {
    return {
      error: new InvalidRequestError({
        code: "invalid_request",
        details: { reason: decoded.left.message },
        message: "Invalid request body",
      }),
      ok: false as const,
    }
  }

  return { data: decoded.right, ok: true as const }
}

function toManualSyncInput(body: SessionCaptureManualSyncBody): ManualSyncBatchInput {
  return {
    provider: body.provider,
    session: {
      kind: body.session.kind,
      sourceUrl: body.session.sourceUrl,
      ...(body.session.sourceSessionId ? { sourceSessionId: body.session.sourceSessionId } : {}),
      ...(body.session.sourceSessionKey ? { sourceSessionKey: body.session.sourceSessionKey } : {}),
      ...(body.session.title ? { title: body.session.title } : {}),
      ...(body.session.workspaceId ? { workspaceId: body.session.workspaceId } : {}),
    },
    ...(body.artifacts
      ? {
          artifacts: body.artifacts.map((artifact) => ({
            artifactKind: artifact.artifactKind,
            ...(artifact.capturedMessageId
              ? { capturedMessageId: artifact.capturedMessageId }
              : {}),
            ...(artifact.contentType ? { contentType: artifact.contentType } : {}),
            ...(artifact.fileObjectId ? { fileObjectId: artifact.fileObjectId } : {}),
            ...(artifact.metadataJson ? { metadataJson: artifact.metadataJson } : {}),
            ...(artifact.sourceArtifactId ? { sourceArtifactId: artifact.sourceArtifactId } : {}),
            ...(artifact.sourceArtifactKey
              ? { sourceArtifactKey: artifact.sourceArtifactKey }
              : {}),
            ...(artifact.title ? { title: artifact.title } : {}),
          })),
        }
      : {}),
    ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
    ...(body.messages
      ? {
          messages: body.messages.map((message) => ({
            role: message.role,
            sequenceNumber: message.sequenceNumber,
            ...(message.contentJson ? { contentJson: message.contentJson } : {}),
            ...(message.contentText ? { contentText: message.contentText } : {}),
            ...(message.metadataJson ? { metadataJson: message.metadataJson } : {}),
            ...(message.sourceCreatedAt
              ? { sourceCreatedAt: new Date(message.sourceCreatedAt) }
              : {}),
            ...(message.sourceFingerprint ? { sourceFingerprint: message.sourceFingerprint } : {}),
            ...(message.sourceMessageId ? { sourceMessageId: message.sourceMessageId } : {}),
            ...(message.sourceMessageKey ? { sourceMessageKey: message.sourceMessageKey } : {}),
          })),
        }
      : {}),
    ...(body.parserVersion ? { parserVersion: body.parserVersion } : {}),
    ...(body.sourceSnapshot
      ? {
          sourceSnapshot: {
            ...(body.sourceSnapshot.capturedAt
              ? { capturedAt: new Date(body.sourceSnapshot.capturedAt) }
              : {}),
            ...(body.sourceSnapshot.fileObjectId
              ? { fileObjectId: body.sourceSnapshot.fileObjectId }
              : {}),
            ...(body.sourceSnapshot.snapshotJson
              ? { snapshotJson: body.sourceSnapshot.snapshotJson }
              : {}),
            ...(body.sourceSnapshot.sourceUrl ? { sourceUrl: body.sourceSnapshot.sourceUrl } : {}),
          },
        }
      : {}),
  }
}

function normalizeRouteError(error: unknown): AppError {
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    "code" in error &&
    "message" in error
  ) {
    return error as AppError
  }

  return new InternalError({
    code: "internal_error",
    details: { cause: String(error) },
    message: "Internal server error",
  })
}

function writeAppError(context: Context, error: AppError): Response {
  const mapped = mapAppErrorToHttp(error)
  return context.json(mapped.body, mapped.status, noStoreHeaders())
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" }
}
