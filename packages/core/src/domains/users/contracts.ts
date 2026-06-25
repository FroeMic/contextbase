export type UserDto = {
  displayName: string
  email: string | null
  emailNormalized: string | null
  emailVerifiedAt: Date | null
  avatarFileObjectId?: string | null
  avatarPublicAssetId?: string | null
  id: string
  lastLoginAt: Date | null
  primaryChannelKind: string | null
  primaryChannelRef: string | null
  status: string
}

export type CreateUserInput = {
  displayName: string
  email?: string | null
  primaryChannelKind?: string | null
  primaryChannelRef?: string | null
  role?: string
}

export type UpdateUserInput = {
  displayName?: string
  email?: string | null
  primaryChannelKind?: string | null
  primaryChannelRef?: string | null
  status?: string
  userId: string
}

export type UpdateOwnUserProfileInput = {
  displayName: string
}
