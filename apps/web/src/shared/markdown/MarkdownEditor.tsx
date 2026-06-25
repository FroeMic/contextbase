import { getMarkRange } from "@tiptap/core"
import { Tiptap, useEditor } from "@tiptap/react"
import { ExternalLink, Paperclip, Trash2 } from "lucide-react"
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react"

import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { FilePreviewDialog, type PreviewableMarkdownFile } from "./FilePreviewDialog"
import {
  appendMarkdownFileReferences,
  filesFromTransfer,
  type MarkdownInlineUploadResult,
  markdownFileReferenceForUpload,
} from "./markdown-editor-upload"
import { markdownEditorExtensions } from "./markdown-extensions"

export function MarkdownEditor({
  "aria-label": ariaLabel,
  className,
  editorClassName,
  onBlur,
  onChange,
  onFileUpload,
  placeholder,
  placeholderClassName,
  showFileUploadButton,
  value,
}: {
  "aria-label": string
  className?: string
  editorClassName?: string
  onBlur?: () => void
  onChange: (value: string) => void
  onFileUpload?: (file: File) => Promise<MarkdownInlineUploadResult>
  placeholder?: string
  placeholderClassName?: string
  showFileUploadButton?: boolean
  value: string
}) {
  const editorRef = useRef<NonNullable<ReturnType<typeof useEditor>> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [linkPopover, setLinkPopover] = useState<EditableLinkPopoverState | null>(null)
  const [previewFile, setPreviewFile] = useState<PreviewableMarkdownFile | null>(null)
  const linkPopoverRef = useRef<HTMLDivElement | null>(null)
  const linkPopoverHideTimerRef = useRef<number | null>(null)
  const clearLinkPopoverHideTimer = useCallback(() => {
    if (linkPopoverHideTimerRef.current === null) return
    window.clearTimeout(linkPopoverHideTimerRef.current)
    linkPopoverHideTimerRef.current = null
  }, [])
  const scheduleLinkPopoverClose = useCallback(() => {
    clearLinkPopoverHideTimer()
    linkPopoverHideTimerRef.current = window.setTimeout(() => {
      setLinkPopover(null)
      linkPopoverHideTimerRef.current = null
    }, 120)
  }, [clearLinkPopoverHideTimer])
  const openLinkPopoverForAnchor = useCallback(
    (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute("href")
      if (!href) return
      clearLinkPopoverHideTimer()
      const rect = anchor.getBoundingClientRect()
      setLinkPopover({
        anchor,
        href,
        label: anchor.textContent?.trim() || href,
        rect: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        },
      })
    },
    [clearLinkPopoverHideTimer],
  )
  const uploadFilesIntoEditor = useCallback(
    async (files: File[]) => {
      if (!onFileUpload || files.length === 0) return

      const currentEditor = editorRef.current
      if (!currentEditor) return

      setIsUploading(true)
      setUploadError(null)
      try {
        const references = []
        for (const file of files) {
          const result = await onFileUpload(file)
          references.push(markdownFileReferenceForUpload(file, result))
        }
        const nextMarkdown = appendMarkdownFileReferences(currentEditor.getMarkdown(), references)
        currentEditor.commands.setContent(nextMarkdown, {
          contentType: "markdown",
          emitUpdate: false,
        })
        onChange(nextMarkdown)
      } catch (caught) {
        setUploadError(caught instanceof Error ? caught.message : "Unable to upload file.")
      } finally {
        setIsUploading(false)
      }
    },
    [onChange, onFileUpload],
  )
  const uploadSelectedFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? [])
      event.currentTarget.value = ""
      void uploadFilesIntoEditor(files)
    },
    [uploadFilesIntoEditor],
  )
  const preventFileDropNavigation = useCallback(
    (event: DragEvent<HTMLFieldSetElement>) => {
      if (!onFileUpload || !hasTransferFiles(event.dataTransfer)) return
      event.preventDefault()
    },
    [onFileUpload],
  )
  const dropFilesIntoEditor = useCallback(
    (event: DragEvent<HTMLFieldSetElement>) => {
      if (event.defaultPrevented) return
      const files = filesFromTransfer(event.dataTransfer)
      if (!onFileUpload || files.length === 0) return
      event.preventDefault()
      void uploadFilesIntoEditor(files)
    },
    [onFileUpload, uploadFilesIntoEditor],
  )
  const editor = useEditor({
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: cn("markdown-content markdown-editor-content", editorClassName),
        "data-placeholder": placeholder ?? "",
      },
      handleDrop: (_view, event) => {
        const files = filesFromTransfer(event.dataTransfer)
        if (!onFileUpload || files.length === 0) return false
        event.preventDefault()
        void uploadFilesIntoEditor(files)
        return true
      },
      handlePaste: (_view, event) => {
        const files = filesFromTransfer(event.clipboardData)
        if (!onFileUpload || files.length === 0) return false
        event.preventDefault()
        void uploadFilesIntoEditor(files)
        return true
      },
    },
    extensions: markdownEditorExtensions,
    immediatelyRender: false,
    onBlur: () => {
      onBlur?.()
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getMarkdown())
    },
  })
  const isEditorEmpty = value.trim().length === 0

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root) return

    function handleMouseOver(event: MouseEvent) {
      const anchor = closestEditableLinkTarget(event.target)
      if (!anchor || !root?.contains(anchor)) return
      openLinkPopoverForAnchor(anchor)
    }

    function handleMouseOut(event: MouseEvent) {
      const anchor = closestEditableLinkTarget(event.target)
      if (!anchor) return
      const relatedTarget = event.relatedTarget
      if (
        relatedTarget instanceof Node &&
        (anchor.contains(relatedTarget) || linkPopoverRef.current?.contains(relatedTarget))
      ) {
        return
      }
      scheduleLinkPopoverClose()
    }

    function handleFocusIn(event: FocusEvent) {
      const anchor = closestEditableLinkTarget(event.target)
      if (!anchor || !root?.contains(anchor)) return
      openLinkPopoverForAnchor(anchor)
    }

    function handleFocusOut(event: FocusEvent) {
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && linkPopoverRef.current?.contains(relatedTarget)) return
      scheduleLinkPopoverClose()
    }

    root.addEventListener("mouseover", handleMouseOver)
    root.addEventListener("mouseout", handleMouseOut)
    root.addEventListener("focusin", handleFocusIn)
    root.addEventListener("focusout", handleFocusOut)
    return () => {
      root.removeEventListener("mouseover", handleMouseOver)
      root.removeEventListener("mouseout", handleMouseOut)
      root.removeEventListener("focusin", handleFocusIn)
      root.removeEventListener("focusout", handleFocusOut)
    }
  }, [editor, openLinkPopoverForAnchor, scheduleLinkPopoverClose])

  useEffect(() => {
    return () => clearLinkPopoverHideTimer()
  }, [clearLinkPopoverHideTimer])

  useEffect(() => {
    const root = editor?.view.dom
    if (!root) return

    function openInlineImagePreview(event: Event) {
      const detail = (event as CustomEvent<PreviewableMarkdownFile>).detail
      if (!detail?.href) return
      setPreviewFile(detail)
    }

    root.addEventListener("contextbase-inline-image-preview", openInlineImagePreview)
    return () => {
      root.removeEventListener("contextbase-inline-image-preview", openInlineImagePreview)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    if (editor.getMarkdown() === value) return

    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
    })
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className={cn("markdown-content markdown-editor-content", className, editorClassName)}
        data-placeholder={placeholder ?? ""}
      />
    )
  }

  return (
    <fieldset
      className={cn("relative min-w-0 border-0 p-0", className)}
      aria-label={`${ariaLabel} editor drop zone`}
      onDragOver={preventFileDropNavigation}
      onDrop={dropFilesIntoEditor}
    >
      <Tiptap editor={editor}>
        <Tiptap.Content />
      </Tiptap>
      {isEditorEmpty && placeholder ? (
        <div
          aria-hidden="true"
          className={cn(
            "markdown-editor-placeholder pointer-events-none absolute top-0 left-0 text-muted-foreground/65",
            placeholderClassName,
          )}
        >
          {placeholder}
        </div>
      ) : null}
      {showFileUploadButton && onFileUpload ? (
        <>
          <input
            className="sr-only"
            multiple
            onChange={uploadSelectedFiles}
            ref={fileInputRef}
            type="file"
          />
          <Button
            aria-label="Attach images, files, or videos"
            className="absolute right-10 bottom-2 size-7"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            size="icon-sm"
            title="Attach images, files, or videos"
            type="button"
            variant="ghost"
          >
            <Paperclip className="size-4" />
          </Button>
        </>
      ) : null}
      {isUploading ? <p className="mt-2 text-xs text-muted-foreground">Uploading...</p> : null}
      {uploadError ? <p className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
      {linkPopover && editor ? (
        <MarkdownLinkPopover
          editor={editor}
          onClose={() => setLinkPopover(null)}
          onPointerEnter={clearLinkPopoverHideTimer}
          onPointerLeave={scheduleLinkPopoverClose}
          popoverRef={linkPopoverRef}
          state={linkPopover}
        />
      ) : null}
      <FilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </fieldset>
  )
}

type EditableLinkPopoverState = {
  anchor: HTMLAnchorElement
  href: string
  label: string
  rect: {
    height: number
    left: number
    top: number
    width: number
  }
}

function MarkdownLinkPopover({
  editor,
  onClose,
  onPointerEnter,
  onPointerLeave,
  popoverRef,
  state,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  onClose: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  popoverRef: React.RefObject<HTMLDivElement | null>
  state: EditableLinkPopoverState
}) {
  const maxLeft =
    typeof window === "undefined" ? state.rect.left : Math.max(8, window.innerWidth - 320)
  const left = Math.min(Math.max(8, state.rect.left + state.rect.width / 2 - 160), maxLeft)

  return (
    <div
      aria-label={`Link actions for ${state.label}`}
      className="fixed z-50 flex h-12 w-80 max-w-[calc(100vw-1rem)] items-center gap-2 rounded-xl border border-border bg-popover px-3 text-popover-foreground shadow-xl"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      ref={popoverRef}
      role="toolbar"
      style={{
        left,
        top: Math.max(8, state.rect.top - 10),
        transform: "translateY(-100%)",
      }}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{state.href}</span>
      <span className="h-7 w-px bg-border" />
      <Button
        aria-label={`Open ${state.href} externally`}
        className="size-8"
        onClick={() => openEditableLinkExternally(state.href)}
        size="icon-sm"
        title="Open externally"
        type="button"
        variant="ghost"
      >
        <ExternalLink className="size-4" />
      </Button>
      <Button
        aria-label={`Delete link for ${state.label}`}
        className="size-8"
        onClick={() => {
          removeEditableLink(editor, state)
          onClose()
        }}
        size="icon-sm"
        title="Delete link"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function closestEditableLinkTarget(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null
}

function openEditableLinkExternally(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

function removeEditableLink(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  state: EditableLinkPopoverState,
) {
  const range = editableLinkMarkRange(editor, state.anchor)
  if (!range) return

  editor.chain().focus().setTextSelection(range).unsetLink().run()
}

function editableLinkMarkRange(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  anchor: HTMLAnchorElement,
) {
  const linkMarkType = editor.schema.marks.link
  if (!linkMarkType) return null

  const firstChild = anchor.firstChild ?? anchor
  try {
    const pos = editor.view.posAtDOM(firstChild, 0)
    for (const candidate of [pos, pos + 1]) {
      if (candidate < 0 || candidate > editor.state.doc.content.size) continue
      const range = getMarkRange(editor.state.doc.resolve(candidate), linkMarkType)
      if (range) return range
    }
  } catch {
    return null
  }

  return null
}

function hasTransferFiles(transfer: DataTransfer | null) {
  if (!transfer) return false
  if (transfer.files.length > 0) return true
  return Array.from(transfer.items).some((item) => item.kind === "file")
}
