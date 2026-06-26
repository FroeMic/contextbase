import {
  type CapturedSession,
  type CapturedSessionArtifact,
  type CapturedSessionMessage,
  queries,
} from "@contextbase/zero-schema"
import { useQuery as useZeroQuery } from "@rocicorp/zero/react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { Bot, Circle, MessageSquareText, UserRound } from "lucide-react"
import { useState } from "react"

import { FilePreviewDialog, type PreviewableMarkdownFile } from "../../shared/markdown"
import { MarkdownViewer } from "../../shared/markdown/MarkdownViewer"
import { Avatar, AvatarFallback } from "../../shared/ui/avatar"
import { Badge } from "../../shared/ui/badge"
import { cn } from "../../shared/ui/cn"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../shared/ui/empty"
import { ScrollArea } from "../../shared/ui/scroll-area"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../shared/ui/sidebar"
import {
  type CapturedTurnKind,
  capturedChatStatusLabel,
  capturedChatTitle,
  capturedMessageText,
  capturedObservationMetadata,
  capturedSessionProviderLabel,
  capturedTurnKind,
  capturedTurnName,
  formatCapturedDateTime,
  formatCapturedTimestamp,
  orderedCapturedMessages,
} from "./presentation"

export function CapturedChatsSidebarSection({ workspaceSlug }: { workspaceSlug: string }) {
  const [sessions] = useZeroQuery(queries.capturedSessionsByWorkspace({ limit: 20 }))

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sessions.length === 0 ? (
            <SidebarMenuItem>
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground/55">
                No captured chats yet
              </div>
            </SidebarMenuItem>
          ) : (
            sessions.map((session) => (
              <CapturedChatHistoryListItem
                key={session.id}
                session={session}
                workspaceSlug={workspaceSlug}
              />
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function CapturedChatHistoryListItem({
  session,
  workspaceSlug,
}: {
  session: CapturedSession
  workspaceSlug: string
}) {
  const matchRoute = useMatchRoute()
  const isActive = Boolean(
    matchRoute({
      params: {
        capturedSessionId: session.id,
        workspaceSlug,
      },
      to: "/app/$workspaceSlug/chats/$capturedSessionId",
    }),
  )
  const providerLabel = capturedSessionProviderLabel(session)
  const statusLabel = capturedChatStatusLabel(session)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-8 gap-2 pr-2.5"
        isActive={isActive}
        render={
          <Link
            params={{ capturedSessionId: session.id, workspaceSlug }}
            preload="intent"
            to="/app/$workspaceSlug/chats/$capturedSessionId"
          />
        }
        tooltip={capturedChatTitle(session)}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            statusLabel === "Complete mirror" ? "bg-emerald-500" : "bg-amber-500",
          )}
          title={`${providerLabel} · ${statusLabel}`}
        >
          <span className="sr-only">
            {providerLabel} {statusLabel}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate">{capturedChatTitle(session)}</span>
        <span aria-hidden className="w-5 shrink-0" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function CapturedChatsListPage({ workspaceSlug }: { workspaceSlug: string }) {
  const [sessions] = useZeroQuery(queries.capturedSessionsByWorkspace({ limit: 100 }))

  if (sessions.length === 0) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center">
        <Empty className="border-0 px-6 py-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareText />
            </EmptyMedia>
            <EmptyTitle>No captured chats</EmptyTitle>
            <EmptyDescription>
              Captured ChatGPT sessions will appear here after the extension syncs them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-4 px-4 py-8 md:py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Captured chats</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Recent sessions</h1>
      </div>
      <div className="flex min-h-0 flex-col gap-2">
        {sessions.map((session) => (
          <Link
            className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
            key={session.id}
            params={{ capturedSessionId: session.id, workspaceSlug }}
            preload="intent"
            to="/app/$workspaceSlug/chats/$capturedSessionId"
          >
            <ProviderDot session={session} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-card-foreground">
                {capturedChatTitle(session)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {capturedSessionProviderLabel(session)} · Synced{" "}
                {formatCapturedDateTime(session.lastSyncedAt)}
              </span>
            </span>
            <Badge className="hidden sm:inline-flex" variant="outline">
              {capturedChatStatusLabel(session)}
            </Badge>
          </Link>
        ))}
      </div>
    </main>
  )
}

export function CapturedChatTranscriptPage({
  capturedSessionId,
  workspaceSlug,
}: {
  capturedSessionId: string
  workspaceSlug: string
}) {
  const [sessions] = useZeroQuery(queries.capturedSessionsByWorkspace({ limit: 500 }))
  const [messages] = useZeroQuery(
    queries.capturedSessionMessages({ capturedSessionId, limit: 1000 }),
  )
  const [artifacts] = useZeroQuery(
    queries.capturedSessionArtifacts({ capturedSessionId, limit: 1000 }),
  )
  const [syncEvents] = useZeroQuery(
    queries.syncEventsByCapturedSession({ capturedSessionId, limit: 5 }),
  )
  const session = sessions.find((item) => item.id === capturedSessionId)
  const orderedMessages = orderedCapturedMessages(messages)

  if (!session) {
    return <CapturedChatMissingState workspaceSlug={workspaceSlug} />
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CapturedChatTranscriptHeader latestSyncEvent={syncEvents[0]} session={session} />
      <CapturedChatMessageList artifacts={artifacts} messages={orderedMessages} session={session} />
    </div>
  )
}

function CapturedChatTranscriptHeader({
  latestSyncEvent,
  session,
}: {
  latestSyncEvent?: { status?: string | null }
  session: CapturedSession
}) {
  const observation = capturedObservationMetadata(session.metadataJson)

  return (
    <div className="shrink-0 border-b border-border/70 bg-background px-4 py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {capturedChatTitle(session)}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {capturedSessionProviderLabel(session)} · Synced{" "}
            {formatCapturedDateTime(session.lastSyncedAt)}
          </p>
        </div>
        <Badge
          variant={
            latestSyncEvent?.status === "failed" || latestSyncEvent?.status === "rejected"
              ? "destructive"
              : "outline"
          }
        >
          {capturedChatStatusLabel(session, latestSyncEvent)}
        </Badge>
        {observation.visibleMessageCount ? (
          <Badge variant="ghost">{observation.visibleMessageCount} observed</Badge>
        ) : null}
      </div>
    </div>
  )
}

export function CapturedChatMessageList({
  artifacts = [],
  messages,
  session,
}: {
  artifacts?: readonly CapturedSessionArtifact[]
  messages: readonly CapturedSessionMessage[]
  session: CapturedSession
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center">
        <Empty className="border-0 px-6 py-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareText />
            </EmptyMedia>
            <EmptyTitle>No messages captured</EmptyTitle>
            <EmptyDescription>
              This session exists, but no messages are visible yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const groupedArtifacts = artifactsByMessageId(artifacts)
  const sessionArtifacts = artifacts.filter((artifact) => !artifact.capturedMessageId)

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 md:py-10">
        {messages.map((message, index) => (
          <CapturedChatMessageBubble
            key={message.id}
            message={message}
            providerLabel={capturedSessionProviderLabel(session)}
            showHeader={!isGroupedWithPreviousMessage(message, messages[index - 1])}
            artifacts={groupedArtifacts.get(message.id) ?? []}
          />
        ))}
        {sessionArtifacts.length > 0 ? (
          <CapturedChatImageArtifacts artifacts={sessionArtifacts} className="pl-10" />
        ) : null}
      </div>
    </ScrollArea>
  )
}

export function CapturedChatMessageBubble({
  artifacts = [],
  message,
  providerLabel,
  showHeader = true,
}: {
  artifacts?: readonly CapturedSessionArtifact[]
  message: CapturedSessionMessage
  providerLabel: string
  showHeader?: boolean
}) {
  const turnKind = capturedTurnKind(message.role)
  const text = capturedMessageText(message)
  const name = capturedTurnName({ providerLabel, role: message.role })
  const timestampLabel = formatCapturedTimestamp(message.sourceCreatedAt ?? message.createdAt)

  return (
    <CapturedChatTurnShell kind={turnKind}>
      <div className="flex w-full max-w-3xl flex-col gap-2">
        {showHeader ? (
          <CapturedChatTurnHeader kind={turnKind} name={name} timestampLabel={timestampLabel} />
        ) : null}

        {turnKind === "assistant" ? (
          <div className="flex w-full flex-col gap-3 pl-10">
            <MarkdownViewer
              className="prose prose-sm max-w-none text-sm leading-6 text-foreground"
              markdown={text}
            />
            <CapturedChatImageArtifacts artifacts={artifacts} />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <div
              className={cn(
                "max-w-[85%] px-4 py-3 text-sm leading-6",
                turnKind === "current_user"
                  ? "self-end rounded-[1.15rem] bg-secondary text-foreground"
                  : null,
                turnKind === "system"
                  ? "self-start rounded-[1.15rem] bg-muted/55 text-muted-foreground"
                  : null,
              )}
            >
              <p className="whitespace-pre-wrap break-words">{text}</p>
            </div>
            <CapturedChatImageArtifacts artifacts={artifacts} />
          </div>
        )}
      </div>
    </CapturedChatTurnShell>
  )
}

export function CapturedChatImageArtifacts({
  artifacts,
  className,
}: {
  artifacts: readonly CapturedSessionArtifact[]
  className?: string
}) {
  const imageArtifacts = artifacts.filter(isDisplayableImageArtifact)
  const [previewFile, setPreviewFile] = useState<PreviewableMarkdownFile | null>(null)
  if (imageArtifacts.length === 0) return null

  return (
    <>
      <div className={cn("grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-3", className)}>
        {imageArtifacts.map((artifact) =>
          artifact.fileObjectId ? (
            <button
              className="group relative block overflow-hidden rounded-md border border-border bg-muted/35"
              key={artifact.id}
              onClick={() => setPreviewFile(previewFileForArtifact(artifact))}
              type="button"
            >
              <img
                alt={artifact.title ?? "Captured image"}
                className="aspect-video h-auto w-full object-cover transition-transform group-hover:scale-[1.02]"
                loading="lazy"
                src={capturedFileContentPath(artifact.fileObjectId)}
              />
            </button>
          ) : (
            <div
              className="flex aspect-video min-w-0 flex-col justify-end rounded-md border border-dashed border-border bg-muted/35 p-2 text-xs text-muted-foreground"
              key={artifact.id}
            >
              <span className="truncate font-medium text-foreground/75">
                {artifact.title ?? "Image"}
              </span>
              <span>Image unavailable</span>
            </div>
          ),
        )}
      </div>
      <FilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </>
  )
}

function CapturedChatTurnShell({
  children,
  kind,
}: {
  children: React.ReactNode
  kind: CapturedTurnKind
}) {
  return (
    <div className={cn("flex w-full", kind === "current_user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex w-full flex-col gap-2",
          kind === "current_user" ? "items-end" : "items-start",
        )}
      >
        {children}
      </div>
    </div>
  )
}

function CapturedChatTurnHeader({
  kind,
  name,
  timestampLabel,
}: {
  kind: CapturedTurnKind
  name: string
  timestampLabel: string
}) {
  const avatar = <CapturedChatTurnAvatar kind={kind} name={name} />

  if (kind === "current_user") {
    return (
      <div className="flex max-w-full flex-nowrap items-center justify-end gap-3 overflow-hidden text-right">
        <div className="flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap">
          {timestampLabel ? (
            <p className="shrink-0 text-xs text-muted-foreground">{timestampLabel}</p>
          ) : null}
          <p className="truncate text-xs font-medium text-foreground/75">{name}</p>
        </div>
        {avatar}
      </div>
    )
  }

  return (
    <div className="flex max-w-full flex-nowrap items-center gap-3 overflow-hidden text-left">
      {avatar}
      <div className="flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap">
        <p className="truncate text-xs font-medium text-foreground/75">{name}</p>
        {timestampLabel ? (
          <p className="shrink-0 text-xs text-muted-foreground">{timestampLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

function CapturedChatTurnAvatar({ kind, name }: { kind: CapturedTurnKind; name: string }) {
  if (kind === "assistant") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Bot className="size-4" />
      </span>
    )
  }

  if (kind === "system") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Circle className="size-3" />
      </span>
    )
  }

  return (
    <Avatar className="size-7" size="sm">
      <AvatarFallback className="bg-secondary-foreground text-xs font-medium text-white">
        {name.slice(0, 1).toUpperCase() || <UserRound className="size-3" />}
      </AvatarFallback>
    </Avatar>
  )
}

function ProviderDot({ session }: { session: CapturedSession }) {
  const statusLabel = capturedChatStatusLabel(session)

  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        statusLabel === "Complete mirror" ? "bg-emerald-500" : "bg-amber-500",
      )}
      title={`${capturedSessionProviderLabel(session)} · ${statusLabel}`}
    />
  )
}

function artifactsByMessageId(artifacts: readonly CapturedSessionArtifact[]) {
  const grouped = new Map<string, CapturedSessionArtifact[]>()
  for (const artifact of artifacts) {
    if (!artifact.capturedMessageId) continue
    const group = grouped.get(artifact.capturedMessageId) ?? []
    group.push(artifact)
    grouped.set(artifact.capturedMessageId, group)
  }
  return grouped
}

function isDisplayableImageArtifact(artifact: CapturedSessionArtifact) {
  return (
    artifact.artifactKind === "image" && (artifact.contentType ?? "image/").startsWith("image/")
  )
}

function capturedFileContentPath(fileObjectId: string) {
  return `/api/files/${encodeURIComponent(fileObjectId)}/content`
}

function previewFileForArtifact(artifact: CapturedSessionArtifact): PreviewableMarkdownFile {
  const href = capturedFileContentPath(artifact.fileObjectId ?? "")
  return {
    contentType: artifact.contentType,
    href,
    label: artifact.title ?? "Captured image",
    originalFilename: artifact.title,
  }
}

function CapturedChatMissingState({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="flex h-full min-h-[28rem] items-center justify-center">
      <Empty className="border-0 px-6 py-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareText />
          </EmptyMedia>
          <EmptyTitle>Captured chat not found</EmptyTitle>
          <EmptyDescription>
            This session is not available in the current workspace.
          </EmptyDescription>
        </EmptyHeader>
        <Link
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          params={{ workspaceSlug }}
          to="/app/$workspaceSlug/chats"
        >
          Back to chats
        </Link>
      </Empty>
    </div>
  )
}

function isGroupedWithPreviousMessage(
  currentMessage: CapturedSessionMessage,
  previousMessage: CapturedSessionMessage | undefined,
) {
  if (!previousMessage) return false
  if (capturedTurnKind(currentMessage.role) !== capturedTurnKind(previousMessage.role)) return false

  const currentTime = currentMessage.sourceCreatedAt ?? currentMessage.createdAt
  const previousTime = previousMessage.sourceCreatedAt ?? previousMessage.createdAt
  if (!currentTime || !previousTime) return false

  return Math.abs(currentTime - previousTime) <= 60_000
}
