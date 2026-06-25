import { settingsRouter } from "../domains/settings/server/trpc-router"
import { router } from "./server"

export const appRouter = router({
  settings: settingsRouter,
})

export type AppRouter = typeof appRouter
