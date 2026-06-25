CREATE TABLE "api_tokens" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"principal_kind" varchar(32) DEFAULT 'user' NOT NULL,
	"principal_id" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"label" text DEFAULT 'bootstrap' NOT NULL,
	"scope_json" text DEFAULT '["contextbase:read","contextbase:write","contextbase:files"]' NOT NULL,
	"created_by_user_id" varchar(32),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_magic_links" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"email_normalized" text NOT NULL,
	"token_hash" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"active_workspace_id" varchar(32) NOT NULL,
	"active_workspace_slug" varchar(80) NOT NULL,
	"session_token_hash" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"user_agent" text,
	"ip_address" varchar(128),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_rules" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32),
	"workspace_slug" varchar(80),
	"flag_key" text NOT NULL,
	"value_json" text NOT NULL,
	"conditions_json" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_by_id" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_objects" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32),
	"workspace_slug" varchar(80),
	"scope_kind" varchar(32) DEFAULT 'workspace' NOT NULL,
	"owner_kind" varchar(32),
	"owner_id" varchar(32),
	"provider" varchar(32) NOT NULL,
	"object_key" text,
	"visibility" varchar(32) DEFAULT 'private' NOT NULL,
	"usage_kind" varchar(32) DEFAULT 'workspace_file' NOT NULL,
	"public_asset_id" varchar(32),
	"content_type" varchar(160),
	"byte_size" integer,
	"sha256" varchar(64),
	"original_filename" text,
	"storage_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_by_kind" varchar(32),
	"created_by_id" varchar(32),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_objects_storage_status_check" CHECK ("file_objects"."storage_status" in ('pending', 'available', 'failed', 'delete_pending', 'deleted')),
	CONSTRAINT "file_objects_scope_kind_check" CHECK ("file_objects"."scope_kind" in ('user', 'workspace')),
	CONSTRAINT "file_objects_scope_required_check" CHECK (("file_objects"."scope_kind" = 'user' and "file_objects"."owner_kind" = 'user' and "file_objects"."owner_id" is not null) or ("file_objects"."scope_kind" = 'workspace' and "file_objects"."workspace_id" is not null and "file_objects"."workspace_slug" is not null)),
	CONSTRAINT "file_objects_visibility_check" CHECK ("file_objects"."visibility" in ('private', 'public')),
	CONSTRAINT "file_objects_usage_kind_check" CHECK ("file_objects"."usage_kind" in ('avatar', 'workspace_file')),
	CONSTRAINT "file_objects_public_avatar_asset_check" CHECK ("file_objects"."visibility" <> 'public' or "file_objects"."usage_kind" <> 'avatar' or "file_objects"."public_asset_id" is not null),
	CONSTRAINT "file_objects_byte_size_positive_check" CHECK ("file_objects"."byte_size" is null or "file_objects"."byte_size" > 0),
	CONSTRAINT "file_objects_sha256_length_check" CHECK ("file_objects"."sha256" is null or length("file_objects"."sha256") = 64),
	CONSTRAINT "file_objects_available_metadata_check" CHECK ("file_objects"."storage_status" <> 'available' or ("file_objects"."object_key" is not null and "file_objects"."content_type" is not null and "file_objects"."byte_size" is not null and "file_objects"."sha256" is not null))
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"grant_id" varchar(32) NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"actor_kind" varchar(32) NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"resource" text NOT NULL,
	"scope_json" text DEFAULT '[]' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_codes" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"resource" text NOT NULL,
	"scope_json" text DEFAULT '[]' NOT NULL,
	"code_challenge_hash" text NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"actor_kind" varchar(32) NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_requests" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"resource" text NOT NULL,
	"scope_json" text DEFAULT '[]' NOT NULL,
	"state" text NOT NULL,
	"state_hash" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" varchar(16) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"client_secret_hash" text,
	"client_secret_expires_at" timestamp with time zone,
	"client_uri" text,
	"metadata_url" text,
	"grant_types_json" text DEFAULT '["authorization_code","refresh_token"]' NOT NULL,
	"redirect_uris_json" text DEFAULT '[]' NOT NULL,
	"response_types_json" text DEFAULT '["code"]' NOT NULL,
	"scope_json" text DEFAULT '["contextbase:read","contextbase:write","contextbase:files","offline_access"]' NOT NULL,
	"token_endpoint_auth_method" varchar(64) DEFAULT 'none' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_grants" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"resource" text NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"actor_kind" varchar(32) NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"scope_json" text DEFAULT '[]' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"grant_id" varchar(32) NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"actor_kind" varchar(32) NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"token_family_id" varchar(32) NOT NULL,
	"parent_token_id" varchar(32),
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"reuse_detected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"session_token_hash" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_email_verifications" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"email_normalized" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"avatar_file_object_id" varchar(32),
	"last_login_at" timestamp with time zone,
	"primary_channel_kind" varchar(64),
	"primary_channel_ref" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"role" varchar(64) DEFAULT 'workspace_member' NOT NULL,
	"invited_by_user_id" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"principal_kind" varchar(32) NOT NULL,
	"principal_id" varchar(32) NOT NULL,
	"role" varchar(64) DEFAULT 'workspace_admin' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_slug_aliases" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"old_slug" varchar(80) NOT NULL,
	"new_slug" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"workspace_name" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_workspace_status_idx" ON "api_tokens" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "api_tokens_principal_idx" ON "api_tokens" USING btree ("principal_kind","principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_magic_links_token_hash_idx" ON "auth_magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_magic_links_user_workspace_idx" ON "auth_magic_links" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "auth_magic_links_email_expires_idx" ON "auth_magic_links" USING btree ("email_normalized","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_idx" ON "auth_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_status_idx" ON "auth_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "auth_sessions_workspace_status_idx" ON "auth_sessions" USING btree ("active_workspace_id","status");--> statement-breakpoint
CREATE INDEX "feature_flag_rules_workspace_enabled_idx" ON "feature_flag_rules" USING btree ("workspace_id","enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "feature_flag_rules_flag_enabled_idx" ON "feature_flag_rules" USING btree ("flag_key","enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "feature_flag_rules_priority_idx" ON "feature_flag_rules" USING btree ("priority","updated_at","id");--> statement-breakpoint
CREATE INDEX "file_objects_workspace_status_created_idx" ON "file_objects" USING btree ("workspace_id","storage_status","created_at");--> statement-breakpoint
CREATE INDEX "file_objects_visibility_usage_idx" ON "file_objects" USING btree ("visibility","usage_kind");--> statement-breakpoint
CREATE INDEX "file_objects_owner_scope_idx" ON "file_objects" USING btree ("scope_kind","owner_kind","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_objects_provider_object_key_uq" ON "file_objects" USING btree ("provider","object_key") WHERE "file_objects"."object_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "file_objects_public_asset_id_uq" ON "file_objects" USING btree ("public_asset_id") WHERE "file_objects"."public_asset_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_idx" ON "oauth_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_grant_idx" ON "oauth_access_tokens" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_workspace_idx" ON "oauth_access_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_resource_expires_idx" ON "oauth_access_tokens" USING btree ("resource","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_idx" ON "oauth_authorization_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_client_idx" ON "oauth_authorization_codes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_workspace_idx" ON "oauth_authorization_codes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_expires_idx" ON "oauth_authorization_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_authorization_requests_client_status_idx" ON "oauth_authorization_requests" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "oauth_authorization_requests_expires_idx" ON "oauth_authorization_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_status_idx" ON "oauth_clients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_grants_active_user_identity_idx" ON "oauth_grants" USING btree ("client_id","resource","workspace_id","user_id","actor_kind","actor_id") WHERE "oauth_grants"."status" = 'active' and "oauth_grants"."actor_kind" = 'user';--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_grants_active_agent_identity_idx" ON "oauth_grants" USING btree ("client_id","resource","workspace_id","actor_kind","actor_id") WHERE "oauth_grants"."status" = 'active' and "oauth_grants"."actor_kind" = 'agent';--> statement-breakpoint
CREATE INDEX "oauth_grants_user_status_idx" ON "oauth_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "oauth_grants_workspace_status_idx" ON "oauth_grants" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_refresh_tokens_token_hash_idx" ON "oauth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_grant_idx" ON "oauth_refresh_tokens" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_family_idx" ON "oauth_refresh_tokens" USING btree ("token_family_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_workspace_idx" ON "oauth_refresh_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_sessions_token_hash_idx" ON "onboarding_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "onboarding_sessions_user_status_idx" ON "onboarding_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "signup_email_verifications_token_hash_idx" ON "signup_email_verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "signup_email_verifications_email_expires_idx" ON "signup_email_verifications" USING btree ("email_normalized","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_idx" ON "users" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "users_avatar_file_object_idx" ON "users" USING btree ("avatar_file_object_id") WHERE "users"."avatar_file_object_id" is not null;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_hash_idx" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_status_idx" ON "workspace_invitations" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations" USING btree ("email_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_memberships_scope_principal_idx" ON "workspace_memberships" USING btree ("workspace_id","principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "workspace_memberships_principal_idx" ON "workspace_memberships" USING btree ("principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "workspace_memberships_workspace_status_idx" ON "workspace_memberships" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_aliases_old_slug_idx" ON "workspace_slug_aliases" USING btree ("old_slug");--> statement-breakpoint
CREATE INDEX "workspace_slug_aliases_workspace_id_idx" ON "workspace_slug_aliases" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_workspace_slug_idx" ON "workspaces" USING btree ("workspace_slug");--> statement-breakpoint
CREATE INDEX "workspaces_status_idx" ON "workspaces" USING btree ("status");