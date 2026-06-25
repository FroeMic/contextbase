"use client"

import { useCopyToClipboard } from "../../shared/hooks/use-copy-to-clipboard"
import { useSerializeStateToUrl } from "../../state/url-sync/use-serialize-state-to-url"
import { Button } from "../ui/button"
import { CheckIcon, LinkIcon } from "../ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

/**
 * Copy Link Button
 * Copies the current URL with serialized datatable state (filters, sorting, etc.) to clipboard
 * Provides visual feedback when copied
 *
 * Note: Works independently of urlSync setting - always serializes current state
 * Uses serializeToFullUrl so the button preserves the current route while replacing table params.
 */
export function CopyLinkButton() {
  const [copy, isCopied] = useCopyToClipboard()
  const { serializeToFullUrl } = useSerializeStateToUrl()

  const handleCopyLink = () => {
    const url = serializeToFullUrl()
    copy(url)
  }

  const label = isCopied ? "Link copied!" : "Copy link with current filters"

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className="flex items-center gap-2 rounded-full max-sm:h-9 max-sm:w-9"
            onClick={handleCopyLink}
            title={label}
            aria-label={label}
          >
            {isCopied ? <CheckIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
