type DataRowStateAttribute = "data-active" | "data-hovered"

interface DataRowStateElement {
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

interface DataRowStateGridElement {
  querySelectorAll: (
    selector: string,
  ) => Iterable<DataRowStateElement> | ArrayLike<DataRowStateElement>
}

export function setDataRowStateAttribute(
  gridElement: DataRowStateGridElement,
  {
    attribute,
    rowId,
    skipActive = false,
    skipSelected = false,
  }: {
    attribute: DataRowStateAttribute
    rowId: string | null
    skipActive?: boolean
    skipSelected?: boolean
  },
) {
  const rowElements = Array.from(gridElement.querySelectorAll("[data-row-id]"))

  for (const element of rowElements) {
    element.removeAttribute(attribute)
  }

  if (!rowId) {
    return
  }

  for (const element of rowElements) {
    if (element.getAttribute("data-row-id") !== rowId) {
      continue
    }

    if (skipSelected && element.getAttribute("data-selected") === "true") {
      continue
    }

    if (skipActive && element.getAttribute("data-active") === "true") {
      continue
    }

    element.setAttribute(attribute, "true")
  }
}
