import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"

import { ContextbaseImage, ContextbaseLink } from "./files"

export const markdownEditorExtensions = [
  StarterKit.configure({
    blockquote: false,
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  ContextbaseLink,
  ContextbaseImage,
  Markdown.configure({
    markedOptions: {
      breaks: false,
      gfm: true,
    },
  }),
]

export const markdownManager = new MarkdownManager({
  extensions: markdownEditorExtensions,
  markedOptions: {
    breaks: false,
    gfm: true,
  },
})
