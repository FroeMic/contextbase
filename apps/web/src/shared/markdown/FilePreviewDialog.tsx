import { useQuery } from "@tanstack/react-query"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import { Download, ExternalLink, FileText, X } from "lucide-react"
import { type ReactElement, useMemo } from "react"

import { Button, buttonVariants } from "../ui/button"
import { cn } from "../ui/cn"
import { CopyIconButton } from "../ui/copy-icon-button"
import {
  MobileFriendlyDialog,
  MobileFriendlyDialogClose,
  MobileFriendlyDialogContent,
  MobileFriendlyDialogDescription,
  MobileFriendlyDialogHeader,
  MobileFriendlyDialogTitle,
} from "../ui/mobile-friendly-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { classifyInlineFile } from "./files"
import { fileUrlForClipboard, fileUrlForNetwork } from "./files/file-url"
import { markdownEditorExtensions, markdownManager } from "./markdown-extensions"

export type PreviewableMarkdownFile = {
  byteSize?: number | null
  contentType?: string | null
  deepLinkUrl?: string | null
  href: string
  label: string
  originalFilename?: string | null
}

export function FilePreviewDialog({
  file,
  onOpenChange,
}: {
  file: PreviewableMarkdownFile | null
  onOpenChange: (open: boolean) => void
}) {
  const networkUrl = file ? fileUrlForNetwork(file.href) : ""
  const kind = file
    ? classifyInlineFile({
        contentType: file.contentType,
        originalFilename: file.originalFilename ?? file.label,
      })
    : "unsupported"
  const canPreview = file !== null && kind !== "unsupported"
  const isImagePreview = file !== null && kind === "image"
  const markdownQuery = useQuery({
    enabled: canPreview && kind === "markdown",
    queryFn: () => fetchMarkdownPreview(networkUrl),
    queryKey: ["markdown-file-preview", networkUrl],
    staleTime: 5 * 60 * 1000,
  })
  const markdown = markdownQuery.data ?? null
  const markdownError = markdownQuery.error
    ? markdownQuery.error instanceof Error
      ? markdownQuery.error.message
      : "Unable to load preview."
    : null

  const markdownPreview = useMemo(() => {
    if (!markdown) return null
    return renderToReactElement({
      content: markdownManager.parse(markdown),
      extensions: markdownEditorExtensions,
    })
  }, [markdown])

  return isImagePreview ? (
    <MobileFriendlyDialog open={canPreview} onOpenChange={onOpenChange}>
      <MobileFriendlyDialogContent
        dialogClassName="flex h-dvh max-h-dvh max-w-none items-center justify-center overflow-hidden bg-transparent p-0 ring-0 sm:max-w-none"
        drawerClassName="flex h-dvh max-h-dvh items-center justify-center overflow-hidden rounded-none border-0 bg-black p-0 shadow-none before:hidden data-[vaul-drawer-direction=bottom]:max-h-dvh"
        drawerShowHandle={false}
        onClick={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false)
        }}
        showCloseButton={false}
      >
        <MobileFriendlyDialogHeader className="sr-only">
          <MobileFriendlyDialogTitle>{file.label}</MobileFriendlyDialogTitle>
          <MobileFriendlyDialogDescription>
            Preview image attachment.
          </MobileFriendlyDialogDescription>
        </MobileFriendlyDialogHeader>
        <figure className="relative m-0 flex h-full w-full items-center justify-center">
          <img
            alt={file.label}
            className="block max-h-[calc(100dvh-1rem)] max-w-full object-contain sm:max-h-[calc(100dvh-3rem)]"
            src={networkUrl}
          />
          <MobileFriendlyDialogClose
            render={
              <Button
                aria-label="Close image preview"
                className="absolute top-3 right-3 bg-background/95 text-foreground shadow-lg ring-1 ring-border/70 hover:bg-background"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <X className="size-4" />
          </MobileFriendlyDialogClose>
        </figure>
      </MobileFriendlyDialogContent>
    </MobileFriendlyDialog>
  ) : (
    <MobileFriendlyDialog open={canPreview} onOpenChange={onOpenChange}>
      <MobileFriendlyDialogContent
        dialogClassName="grid h-dvh max-h-dvh min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none p-0 sm:h-[min(64rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-xl"
        drawerClassName="grid h-[92dvh] max-h-[92dvh] min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-t-xl border border-border bg-popover p-0 shadow-2xl before:hidden data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
        showCloseButton={false}
      >
        <MobileFriendlyDialogHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-left sm:px-5">
          <MobileFriendlyDialogTitle className="min-w-0 flex-1 truncate pr-2">
            {file?.label ?? "File preview"}
          </MobileFriendlyDialogTitle>
          <MobileFriendlyDialogDescription className="sr-only">
            Preview file contents and file actions.
          </MobileFriendlyDialogDescription>
          {file ? (
            <div className="flex shrink-0 items-center gap-1">
              <HeaderTooltip label={file.deepLinkUrl ? "Copy link" : "Copy URL"}>
                <CopyIconButton
                  className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }))}
                  copiedLabel="Copied"
                  iconClassName="size-4"
                  label={file.deepLinkUrl ? "Copy link" : "Copy URL"}
                  value={() => file.deepLinkUrl ?? fileUrlForClipboard(file.href)}
                />
              </HeaderTooltip>
              <HeaderTooltip label="Open in new tab">
                <a
                  aria-label="Open in new tab"
                  className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }))}
                  href={networkUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Open in new tab</span>
                </a>
              </HeaderTooltip>
              <HeaderTooltip label="Download">
                <a
                  aria-label="Download"
                  className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }))}
                  download={file.label}
                  href={networkUrl}
                >
                  <Download className="size-4" />
                  <span className="sr-only">Download</span>
                </a>
              </HeaderTooltip>
            </div>
          ) : null}
          <HeaderTooltip label="Close">
            <MobileFriendlyDialogClose
              render={<Button aria-label="Close" size="icon-sm" variant="ghost" />}
            >
              <X className="size-4" />
            </MobileFriendlyDialogClose>
          </HeaderTooltip>
        </MobileFriendlyDialogHeader>
        <div className="min-h-0 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain bg-background px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
          {file && kind === "markdown" ? (
            <div className="mx-auto min-w-0 max-w-4xl">
              {markdownPreview ? (
                <section className="markdown-content markdown-file-preview min-w-0 max-w-full">
                  {markdownPreview}
                </section>
              ) : (
                <PreviewMessage message={markdownError ?? "Loading preview..."} />
              )}
            </div>
          ) : null}
          {file && kind === "unsupported" ? (
            <PreviewMessage message="Preview is not available for this file type." />
          ) : null}
        </div>
      </MobileFriendlyDialogContent>
    </MobileFriendlyDialog>
  )
}

async function fetchMarkdownPreview(networkUrl: string) {
  const response = await fetch(networkUrl, { credentials: "include" })
  if (!response.ok) throw new Error("Unable to load markdown preview.")
  return response.text()
}

function HeaderTooltip({ children, label }: { children: ReactElement; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function PreviewMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
      <FileText className="size-10" />
      <p>{message}</p>
    </div>
  )
}
