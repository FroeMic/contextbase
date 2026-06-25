import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Download, ExternalLink, FileText } from "lucide-react"

import { cn } from "../../ui/cn"
import { CopyIconButton } from "../../ui/copy-icon-button"
import { classifyInlineFile } from "./file-metadata"
import { fileUrlForNetwork, parseContextbaseFileUrl } from "./file-url"

export type MarkdownFileCardModel = {
  byteSize?: number | null
  contentType?: string | null
  deepLinkUrl?: string | null
  href: string
  kind: "markdown" | "unsupported"
  label: string
  originalFilename?: string | null
}

export function MarkdownFileCard({
  active,
  className,
  file,
  onOpen,
  referenceId,
}: {
  active?: boolean
  className?: string
  file: MarkdownFileCardModel
  onOpen?: (file: MarkdownFileCardModel) => void
  referenceId?: string | null
}) {
  const networkUrl = fileUrlForNetwork(file.href)
  const canPreview = file.kind !== "unsupported"

  return (
    <div
      className={cn("vertical-file-card", active && "vertical-file-target-active", className)}
      data-file-content-type={file.contentType ?? undefined}
      data-file-kind={file.kind}
      data-file-label={file.label}
      data-file-original-filename={file.originalFilename ?? undefined}
      data-file-ref={referenceId ?? undefined}
      data-file-url={file.href}
      data-vertical-file-card="true"
    >
      <FileText aria-hidden="true" className="vertical-file-card-icon" />
      <div className="vertical-file-card-body">
        <span className="vertical-file-card-title">{file.label}</span>
      </div>
      {canPreview && onOpen ? (
        <button
          aria-label={`Open preview for ${file.label}`}
          className="vertical-file-card-action"
          onClick={() => onOpen(file)}
          type="button"
        >
          <FileText aria-hidden="true" />
          <span className="sr-only">Open preview</span>
        </button>
      ) : null}
      {file.deepLinkUrl ? (
        <CopyIconButton
          className="vertical-file-card-action"
          label={`Copy link to ${file.label}`}
          value={() => file.deepLinkUrl}
        />
      ) : null}
      <a
        aria-label={`Open ${file.label} in new tab`}
        className="vertical-file-card-action"
        href={networkUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" />
      </a>
      <a
        aria-label={`Download ${file.label}`}
        className="vertical-file-card-action"
        download={file.label}
        href={networkUrl}
      >
        <Download aria-hidden="true" />
        <span className="sr-only">Download</span>
      </a>
    </div>
  )
}

export function standaloneFileCardFromParagraphNode(
  node: ProseMirrorNode,
  metadata?: { contentType?: string | null; originalFilename?: string | null } | null,
): MarkdownFileCardModel | null {
  if (node.type.name !== "paragraph" || node.childCount !== 1) return null

  const child = node.child(0)
  if (!child.isText || child.marks.length !== 1) return null

  const link = child.marks[0]
  if (link?.type.name !== "link") return null

  const href = String(link.attrs.href ?? "")
  if (!parseContextbaseFileUrl(href)) return null

  const label = child.text?.trim() || "File"
  const kind = classifyInlineFile({
    contentType: metadata?.contentType,
    originalFilename: metadata?.originalFilename ?? label,
  })
  if (kind === "image") return null

  return {
    contentType: metadata?.contentType ?? null,
    href,
    kind,
    label,
    originalFilename: metadata?.originalFilename ?? null,
  }
}
