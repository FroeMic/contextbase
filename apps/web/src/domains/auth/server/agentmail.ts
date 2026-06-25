export type AgentMailConfig = {
  apiKey: string
  fetch?: typeof fetch
  fromName: string
  inboxId: string
}

export type MagicLinkEmail = {
  email: string
  expiresAt: Date
  linkUrl: string
}

export async function sendMagicLinkEmail(config: AgentMailConfig, message: MagicLinkEmail) {
  const runFetch = config.fetch ?? fetch
  const response = await runFetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/send`,
    {
      body: JSON.stringify({
        from_name: config.fromName,
        html: `<p>Open this link to sign in:</p><p><a href="${message.linkUrl}">${message.linkUrl}</a></p>`,
        subject: "Sign in to Contextbase",
        text: `Open this link to sign in: ${message.linkUrl}\n\nThis link expires at ${message.expiresAt.toISOString()}.`,
        to: [message.email],
      }),
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  )

  if (!response.ok) {
    throw new Error(`AgentMail send failed with status ${response.status}`)
  }
}
