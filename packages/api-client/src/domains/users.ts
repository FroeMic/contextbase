import type {
  UserCreateBody,
  UserListResponse,
  UserResponse,
  UserUpdateBody,
} from "@contextbase/contracts"

import type { ApiClient } from "../client"

export type UserPayload = UserCreateBody

export function createUserClient(client: ApiClient) {
  return {
    create: (payload: UserPayload) => client.post<UserResponse>("/api/v1/users", payload),
    get: (userId: string) => client.get<UserResponse>(`/api/v1/users/${userId}`),
    list: () => client.get<UserListResponse>("/api/v1/users"),
    update: (userId: string, payload: UserUpdateBody) =>
      client.patch<UserResponse>(`/api/v1/users/${userId}`, payload),
  }
}
