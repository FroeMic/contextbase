import { Avatar, AvatarFallback, AvatarImage } from "../../../shared/ui/avatar"

export type SettingsPrincipal = {
  avatarUrl?: string | null
  displayName: string
  id: string
  kind: string
}

export function PrincipalAvatar({
  principal,
  size = "sm",
}: {
  principal: SettingsPrincipal
  size?: "default" | "sm"
}) {
  const avatarUrl = principal.avatarUrl ?? ""

  return (
    <Avatar size={size}>
      {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
      <AvatarFallback>{principalInitial(principal.displayName)}</AvatarFallback>
    </Avatar>
  )
}

export function principalInitial(label: string) {
  return label.trim().match(/\p{L}/u)?.[0]?.toUpperCase() ?? "?"
}
