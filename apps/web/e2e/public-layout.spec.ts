import { expect, test } from "@playwright/test"

test.describe("public layout", () => {
  test("renders the SSR landing page without horizontal overflow", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByText("Contextbase")).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Business-scoped task runtime, activity, and agent operations.",
      }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test("renders the login form without horizontal overflow", async ({ page }) => {
    await page.goto("/login?redirect_to=%2Facme%2Ftasks")

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

async function expectNoHorizontalOverflow(page: {
  evaluate: <T>(pageFunction: () => T | Promise<T>) => Promise<T>
}) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
