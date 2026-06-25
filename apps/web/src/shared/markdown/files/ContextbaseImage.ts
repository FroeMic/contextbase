import { Image } from "@tiptap/extension-image"

import { buildFileOpenUrl } from "./file-deeplink"
import { parseContextbaseFileFragment, withContextbaseFileWidth } from "./file-url"

type MarkdownImageToken = {
  href?: string | null
  text?: string | null
  title?: string | null
}

const minWidthRatio = 0.2
const maxWidthRatio = 1
const resizeHandleClassBySide = {
  left: "contextbase-inline-image-resize-handle-left",
  right: "contextbase-inline-image-resize-handle-right",
} as const

export const ContextbaseImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthRatio: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const parsed = Number.parseFloat(element.getAttribute("data-v-width") ?? "")
          return Number.isFinite(parsed) ? clampWidthRatio(parsed) : null
        },
        renderHTML: (attributes: { widthRatio?: number | null }) =>
          attributes.widthRatio
            ? {
                "data-v-width": String(clampWidthRatio(attributes.widthRatio)),
                style: `width: ${formatWidthPercent(attributes.widthRatio)}%;`,
              }
            : {},
      },
    }
  },

  parseMarkdown: (token, helpers) => {
    const imageToken = token as MarkdownImageToken
    const src = imageToken.href ?? ""
    return helpers.createNode("image", {
      alt: imageToken.text ?? "",
      src,
      title: imageToken.title ?? null,
      widthRatio: parseContextbaseFileFragment(src).width,
    })
  },

  renderMarkdown: (node) => {
    const src = String(node.attrs?.src ?? "")
    const widthRatio = node.attrs?.widthRatio
    const renderedSrc =
      typeof widthRatio === "number" ? withContextbaseFileWidth(src, widthRatio) : src
    const alt = node.attrs?.alt ?? ""
    const title = node.attrs?.title ?? ""

    return title ? `![${alt}](${renderedSrc} "${title}")` : `![${alt}](${renderedSrc})`
  },

  addNodeView() {
    if (typeof document === "undefined") {
      return null
    }

    const extensionName = this.name

    return ({ editor, getPos, node }) => {
      let currentNode = node
      let currentWidthRatio = widthRatioFromNode(currentNode)
      let removeDragListeners: (() => void) | null = null
      const container = document.createElement("div")
      const frame = document.createElement("span")
      const image = document.createElement("img")
      const leftHandle = createResizeHandle("left")
      const rightHandle = createResizeHandle("right")

      container.className = "contextbase-inline-image-node"
      container.contentEditable = "false"
      frame.className = "contextbase-inline-image-frame"
      image.className = "contextbase-inline-image"
      image.draggable = false

      function updateDomFromNode() {
        const attrs = currentNode.attrs as {
          alt?: string | null
          src?: string | null
          title?: string | null
          widthRatio?: number | null
        }
        image.src = String(attrs.src ?? "")
        image.alt = String(attrs.alt ?? "")
        if (attrs.title) {
          image.title = String(attrs.title)
        } else {
          image.removeAttribute("title")
        }
        image.dataset.fileLabel = image.alt || "Image"
        image.dataset.fileUrl = String(attrs.src ?? "")
        image.dataset.contextbaseInlineImage = "true"
        currentWidthRatio = widthRatioFromNode(currentNode)
        frame.style.width = `${formatWidthPercent(currentWidthRatio)}%`
        frame.dataset.vWidth = String(currentWidthRatio)
      }

      function commitWidthRatio(widthRatio: number) {
        const position = getPos()
        if (typeof position !== "number") return
        currentWidthRatio = clampWidthRatio(widthRatio)
        frame.style.width = `${formatWidthPercent(currentWidthRatio)}%`
        editor
          .chain()
          .setNodeSelection(position)
          .updateAttributes(extensionName, { widthRatio: currentWidthRatio })
          .run()
      }

      function startResize(side: "left" | "right", event: PointerEvent) {
        event.preventDefault()
        event.stopPropagation()
        const position = getPos()
        if (typeof position === "number") {
          editor.chain().setNodeSelection(position).run()
        }
        const target = event.currentTarget
        if (target instanceof HTMLElement) {
          target.setPointerCapture(event.pointerId)
        }

        const startX = event.clientX
        const startWidthRatio = currentWidthRatio
        const availableWidth = Math.max(
          1,
          editor.view.dom.clientWidth || frame.getBoundingClientRect().width,
        )
        const direction = side === "right" ? 1 : -1

        function onPointerMove(moveEvent: PointerEvent) {
          moveEvent.preventDefault()
          const deltaX = moveEvent.clientX - startX
          const widthDeltaRatio = (2 * deltaX * direction) / availableWidth
          const nextWidthRatio = clampWidthRatio(startWidthRatio + widthDeltaRatio)
          currentWidthRatio = nextWidthRatio
          frame.style.width = `${formatWidthPercent(nextWidthRatio)}%`
          frame.dataset.vWidth = String(nextWidthRatio)
        }

        function onPointerUp(upEvent: PointerEvent) {
          upEvent.preventDefault()
          cleanup()
          commitWidthRatio(currentWidthRatio)
        }

        function cleanup() {
          window.removeEventListener("pointermove", onPointerMove)
          window.removeEventListener("pointerup", onPointerUp)
          window.removeEventListener("pointercancel", cleanup)
          removeDragListeners = null
        }

        removeDragListeners?.()
        removeDragListeners = cleanup
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
        window.addEventListener("pointercancel", cleanup)
      }

      image.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        const attrs = currentNode.attrs as {
          alt?: string | null
          src?: string | null
        }
        const href = String(attrs.src ?? "")
        if (!href) return
        editor.view.dom.dispatchEvent(
          new CustomEvent("contextbase-inline-image-preview", {
            bubbles: true,
            detail: {
              contentType: "image/*",
              deepLinkUrl: buildInlineImageDeepLink(href, true),
              href,
              label: String(attrs.alt ?? "") || "Image",
            },
          }),
        )
      })
      leftHandle.addEventListener("pointerdown", (event) => startResize("left", event))
      rightHandle.addEventListener("pointerdown", (event) => startResize("right", event))
      updateDomFromNode()
      frame.append(leftHandle, image, rightHandle)
      container.append(frame)

      return {
        destroy: () => {
          removeDragListeners?.()
        },
        dom: container,
        ignoreMutation: () => true,
        stopEvent: (event) =>
          event.target instanceof HTMLElement &&
          event.target.closest(".contextbase-inline-image-node") !== null,
        update: (updatedNode) => {
          if (updatedNode.type !== currentNode.type) return false
          currentNode = updatedNode
          updateDomFromNode()
          return true
        },
      }
    }
  },
}).configure({
  HTMLAttributes: {
    class: "contextbase-inline-image",
  },
})

function createResizeHandle(side: "left" | "right") {
  const handle = document.createElement("button")
  handle.type = "button"
  handle.className = `contextbase-inline-image-resize-handle ${resizeHandleClassBySide[side]}`
  handle.setAttribute("aria-label", `Resize image from ${side}`)
  return handle
}

function widthRatioFromNode(node: { attrs?: { widthRatio?: number | null } }) {
  const widthRatio = node.attrs?.widthRatio
  return typeof widthRatio === "number" ? clampWidthRatio(widthRatio) : maxWidthRatio
}

function clampWidthRatio(widthRatio: number) {
  if (!Number.isFinite(widthRatio)) return maxWidthRatio
  return Math.min(maxWidthRatio, Math.max(minWidthRatio, widthRatio))
}

function formatWidthPercent(widthRatio: number) {
  return Number((clampWidthRatio(widthRatio) * 100).toFixed(1))
}

function buildInlineImageDeepLink(href: string, open: boolean) {
  if (typeof window === "undefined") return null
  const referenceId = parseContextbaseFileFragment(href).refId
  if (!referenceId) return null
  return buildFileOpenUrl(window.location.href, {
    open,
    referenceId,
  })
}
