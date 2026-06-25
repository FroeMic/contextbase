import { mergeAttributes } from "@tiptap/core"
import { Link } from "@tiptap/extension-link"

import { parseContextbaseFileUrl } from "./file-url"

export const ContextbaseLink = Link.extend({
  renderHTML({ HTMLAttributes, mark }) {
    const rendered = this.parent?.({ HTMLAttributes, mark })
    const attrs = Array.isArray(rendered) ? rendered[1] : {}

    return [
      "a",
      mergeAttributes(attrs, {
        "data-contextbase-file-link": parseContextbaseFileUrl(String(HTMLAttributes.href ?? ""))
          ? "true"
          : null,
      }),
      0,
    ]
  },
}).configure({
  autolink: false,
  linkOnPaste: true,
  openOnClick: false,
})
