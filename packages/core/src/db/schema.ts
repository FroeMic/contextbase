import { sql } from "drizzle-orm"
import { authMagicLinks, authSessions } from "../domains/auth/schema"
import { featureFlagRules } from "../domains/feature-flags/schema"
import { fileObjects } from "../domains/files/schema"
import { workspaceInvitations } from "../domains/invitations/schema"
import {
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
} from "../domains/oauth/schema"
import { onboardingSessions, signupEmailVerifications } from "../domains/signup/schema"
import { apiTokens, users, workspaceMemberships } from "../domains/users/schema"
import { workspaceSlugAliases, workspaces } from "../domains/workspaces/schema"

export { authMagicLinks, authSessions } from "../domains/auth/schema"
export { featureFlagRules } from "../domains/feature-flags/schema"
export { fileObjects } from "../domains/files/schema"
export { workspaceInvitations } from "../domains/invitations/schema"
export {
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
} from "../domains/oauth/schema"
export { onboardingSessions, signupEmailVerifications } from "../domains/signup/schema"
export {
  apiTokens,
  users,
  workspaceMemberships,
} from "../domains/users/schema"
export { workspaceSlugAliases, workspaces } from "../domains/workspaces/schema"

export const schemaTables = {
  apiTokens,
  authMagicLinks,
  authSessions,
  featureFlagRules,
  fileObjects,
  workspaceInvitations,
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
  onboardingSessions,
  signupEmailVerifications,
  users,
  workspaceMemberships,
  workspaceSlugAliases,
  workspaces,
}

export const touchUpdatedAtSql = sql`updated_at = now()`
