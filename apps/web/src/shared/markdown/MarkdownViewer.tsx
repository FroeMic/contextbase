import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import { Download, ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "../ui/cn"
import { CopyIconButton } from "../ui/copy-icon-button"
import { FilePreviewDialog, type PreviewableMarkdownFile } from "./FilePreviewDialog"
import {
  buildFileOpenUrl,
  classifyInlineFile,
  type FileOpenIntent,
  fileUrlForNetwork,
  MarkdownFileCard,
  parseContextbaseFileFragment,
  parseContextbaseFileUrl,
  scrollDeepLinkTargetIntoView,
  standaloneFileCardFromParagraphNode,
} from "./files"
import { markdownEditorExtensions, markdownManager } from "./markdown-extensions"

export type MarkdownViewerInlineFile = {
  byteSize?: number | null
  contentType?: string | null
  fileId: string
  originalFilename?: string | null
  referenceId?: string | null
}

export function MarkdownViewer({
  ariaLabel,
  className,
  commentId,
  emptyLabel,
  fileOpenIntent,
  inlineFiles,
  markdown,
  placeholder,
}: {
  ariaLabel?: string
  className?: string
  commentId?: string | null
  emptyLabel?: string
  fileOpenIntent?: FileOpenIntent | null
  inlineFiles?: readonly MarkdownViewerInlineFile[] | null
  markdown: string | null | undefined
  placeholder?: string
}) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [previewFile, setPreviewFile] = useState<PreviewableMarkdownFile | null>(null)
  const inlineFileMetadata = useMemo(
    () => createInlineFileMetadataLookup(inlineFiles),
    [inlineFiles],
  )
  const content = useMemo(() => {
    const source = markdown?.trim()
    if (!source) return null

    return renderToReactElement({
      content: markdownManager.parse(source),
      extensions: markdownEditorExtensions,
      options: {
        nodeMapping: {
          image: ({ node }) => {
            const src = String(node.attrs.src ?? "")
            const parsedFile = parseContextbaseFileUrl(src)
            const referenceId = parseContextbaseFileFragment(src).refId
            const metadata = parsedFile
              ? inlineFileMetadataFor(inlineFileMetadata, parsedFile.fileId, referenceId)
              : null
            const isActive = referenceId != null && fileOpenIntent?.referenceId === referenceId
            const label = String(node.attrs.alt ?? "") || parsedFile?.fileId || "Image"
            const widthRatio =
              typeof node.attrs.widthRatio === "number" ? node.attrs.widthRatio : null
            const closedDeepLinkUrl = referenceId
              ? buildInlineFileDeepLink(referenceId, commentId, false)
              : null
            const openDeepLinkUrl = referenceId
              ? buildInlineFileDeepLink(referenceId, commentId, true)
              : null
            const metadataKind = metadata
              ? classifyInlineFile({
                  contentType: metadata.contentType,
                  originalFilename: metadata.originalFilename ?? label,
                })
              : null
            const fallbackFileKind =
              metadataKind === "image" ? null : (metadataKind ?? explicitNonImageFileKind(label))
            if (parsedFile && fallbackFileKind) {
              return (
                <MarkdownFileCard
                  active={isActive}
                  file={{
                    byteSize: metadata?.byteSize ?? null,
                    contentType: metadata?.contentType ?? null,
                    deepLinkUrl: closedDeepLinkUrl,
                    href: src,
                    kind: fallbackFileKind,
                    label,
                    originalFilename: metadata?.originalFilename ?? null,
                  }}
                  onOpen={(openedFile) =>
                    setPreviewFile({
                      ...openedFile,
                      deepLinkUrl: openDeepLinkUrl ?? openedFile.deepLinkUrl,
                    })
                  }
                  referenceId={referenceId}
                />
              )
            }
            const image = (
              <img
                alt={label}
                className="contextbase-inline-image"
                data-file-label={label}
                data-file-original-filename={metadata?.originalFilename ?? undefined}
                data-file-ref={referenceId ?? undefined}
                data-file-url={src}
                data-file-content-type={metadata?.contentType ?? undefined}
                data-contextbase-inline-image={parsedFile ? "true" : undefined}
                data-v-width={widthRatio ?? undefined}
                src={fileUrlForNetwork(src)}
                style={
                  widthRatio ? { width: `${Number((widthRatio * 100).toFixed(1))}%` } : undefined
                }
              />
            )

            if (!parsedFile) return image

            return (
              <figure
                className={cn(
                  "contextbase-inline-image-frame",
                  isActive && "vertical-file-target-active",
                )}
                data-contextbase-inline-image="true"
              >
                <button
                  aria-label={`Open image preview for ${label}`}
                  className="contextbase-inline-image-button"
                  onClick={() =>
                    setPreviewFile({
                      contentType: "image/*",
                      deepLinkUrl: openDeepLinkUrl,
                      href: src,
                      label,
                    })
                  }
                  type="button"
                >
                  {image}
                  <span className="sr-only">Open image preview</span>
                </button>
                <span className="contextbase-inline-image-actions">
                  {closedDeepLinkUrl ? (
                    <CopyIconButton
                      className="contextbase-inline-image-action"
                      label={`Copy link to ${label}`}
                      value={closedDeepLinkUrl}
                    />
                  ) : null}
                  <a
                    aria-label={`Open ${label} in new tab`}
                    className="contextbase-inline-image-action"
                    href={fileUrlForNetwork(src)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                  <a
                    aria-label={`Download ${label}`}
                    className="contextbase-inline-image-action"
                    download={label}
                    href={fileUrlForNetwork(src)}
                  >
                    <Download aria-hidden="true" />
                  </a>
                </span>
              </figure>
            )
          },
          paragraph: ({ children, node }) => {
            const href = standaloneContextbaseFileHrefFromParagraphNode(node)
            const parsedFile = href ? parseContextbaseFileUrl(href) : null
            const referenceId = href ? parseContextbaseFileFragment(href).refId : null
            const metadata = parsedFile
              ? inlineFileMetadataFor(inlineFileMetadata, parsedFile.fileId, referenceId)
              : null
            const file = standaloneFileCardFromParagraphNode(node, metadata)
            if (file) {
              const cardFile = referenceId
                ? {
                    ...file,
                    deepLinkUrl: buildInlineFileDeepLink(referenceId, commentId, false),
                  }
                : file
              return (
                <MarkdownFileCard
                  active={referenceId != null && fileOpenIntent?.referenceId === referenceId}
                  file={cardFile}
                  onOpen={(openedFile) =>
                    setPreviewFile({
                      ...openedFile,
                      deepLinkUrl: referenceId
                        ? buildInlineFileDeepLink(referenceId, commentId, true)
                        : openedFile.deepLinkUrl,
                    })
                  }
                  referenceId={referenceId}
                />
              )
            }
            return <p>{children as ReactNode}</p>
          },
        },
      },
    })
  }, [commentId, fileOpenIntent?.referenceId, inlineFileMetadata, markdown])

  useEffect(() => {
    const referenceId = fileOpenIntent?.referenceId
    const root = sectionRef.current
    if (!referenceId || !root) return

    const target = Array.from(root.querySelectorAll<HTMLElement>("[data-file-ref]")).find(
      (element) => element.dataset.fileRef === referenceId,
    )
    if (!target) return

    scrollDeepLinkTargetIntoView(target)
    if (!fileOpenIntent.open) return

    const href = target.dataset.fileUrl
    if (!href) return
    if (target.dataset.fileKind === "unsupported") return
    setPreviewFile({
      contentType:
        target.dataset.fileContentType ??
        (target.dataset.contextbaseInlineImage === "true" ? "image/*" : undefined),
      deepLinkUrl: buildInlineFileDeepLink(referenceId, fileOpenIntent.commentId ?? null, true),
      href,
      label: target.dataset.fileLabel ?? "File",
      originalFilename: target.dataset.fileOriginalFilename,
    })
  }, [fileOpenIntent])

  if (!content) {
    const fallback = emptyLabel ?? placeholder

    return fallback ? (
      <section
        aria-label={ariaLabel}
        className={cn("markdown-content text-muted-foreground", className)}
      >
        {fallback}
      </section>
    ) : null
  }

  return (
    <>
      <section
        aria-label={ariaLabel}
        className={cn("markdown-content", className)}
        ref={sectionRef}
      >
        {content}
      </section>
      <FilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </>
  )
}

type InlineFileMetadataLookup = {
  byFileId: Map<string, MarkdownViewerInlineFile>
  byReferenceId: Map<string, MarkdownViewerInlineFile>
}

function createInlineFileMetadataLookup(
  files: readonly MarkdownViewerInlineFile[] | null | undefined,
): InlineFileMetadataLookup {
  const byFileId = new Map<string, MarkdownViewerInlineFile>()
  const byReferenceId = new Map<string, MarkdownViewerInlineFile>()
  for (const file of files ?? []) {
    byFileId.set(file.fileId, file)
    if (file.referenceId) byReferenceId.set(file.referenceId, file)
  }
  return { byFileId, byReferenceId }
}

function inlineFileMetadataFor(
  lookup: InlineFileMetadataLookup,
  fileId: string,
  referenceId: string | null,
) {
  return (referenceId ? lookup.byReferenceId.get(referenceId) : null) ?? lookup.byFileId.get(fileId)
}

function standaloneContextbaseFileHrefFromParagraphNode(
  node: Parameters<typeof standaloneFileCardFromParagraphNode>[0],
) {
  if (node.type.name !== "paragraph" || node.childCount !== 1) return null
  const child = node.child(0)
  if (!child.isText || child.marks.length !== 1) return null
  const link = child.marks[0]
  if (link?.type.name !== "link") return null
  const href = String(link.attrs.href ?? "")
  return parseContextbaseFileUrl(href) ? href : null
}

function explicitNonImageFileKind(label: string) {
  const normalized = label.trim().toLowerCase()
  const extension = /\.([a-z0-9]+)$/.exec(normalized)?.[1] ?? null
  if (!extension) return null
  if (["apng", "avif", "gif", "jpeg", "jpg", "png", "svg", "webp"].includes(extension)) {
    return null
  }
  const kind = classifyInlineFile({ contentType: null, originalFilename: normalized })
  return kind === "image" ? null : kind
}

function buildInlineFileDeepLink(
  referenceId: string,
  commentId: string | null | undefined,
  open: boolean,
) {
  if (typeof window === "undefined") return null
  return buildFileOpenUrl(window.location.href, {
    ...(commentId ? { commentId } : {}),
    open,
    referenceId,
  })
}
