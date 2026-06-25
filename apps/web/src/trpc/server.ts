import { initTRPC } from "@trpc/server"

import type { createTrpcContext } from "./context"

const trpc = initTRPC.context<Awaited<ReturnType<typeof createTrpcContext>>>().create()

export const router = trpc.router
export const publicProcedure = trpc.procedure
export const protectedProcedure = trpc.procedure
