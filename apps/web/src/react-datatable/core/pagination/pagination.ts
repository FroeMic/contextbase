export type PaginationItem = number | "ellipsis"

interface BuildPaginationItemsOptions {
  currentPage: number
  pageCount: number
}

export function buildPaginationItems({
  currentPage,
  pageCount,
}: BuildPaginationItemsOptions): PaginationItem[] {
  if (pageCount <= 0) {
    return []
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), pageCount)

  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  if (safeCurrentPage <= 3) {
    return [1, 2, 3, "ellipsis", pageCount]
  }

  if (safeCurrentPage >= pageCount - 2) {
    return [1, "ellipsis", pageCount - 2, pageCount - 1, pageCount]
  }

  return [1, "ellipsis", safeCurrentPage, "ellipsis", pageCount]
}

export function getEllipsisPageOptions(
  items: readonly PaginationItem[],
  ellipsisIndex: number,
): number[] {
  if (items[ellipsisIndex] !== "ellipsis") {
    return []
  }

  const allPages = items.filter((item): item is number => typeof item === "number")
  const lastPage = allPages[allPages.length - 1]

  if (lastPage === undefined) {
    return []
  }

  return Array.from({ length: lastPage }, (_, index) => index + 1)
}
