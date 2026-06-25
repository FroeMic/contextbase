CREATE TABLE "capture_clients" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"created_by_user_id" varchar(32),
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"permission_json" text DEFAULT '["session_capture:write","session_capture:status"]' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_clients_status_check" CHECK ("capture_clients"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "capture_providers" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"provider_key" varchar(80) NOT NULL,
	"display_name" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_providers_status_check" CHECK ("capture_providers"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "captured_session_artifacts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"captured_session_id" varchar(32) NOT NULL,
	"captured_message_id" varchar(32),
	"file_object_id" varchar(32),
	"artifact_kind" varchar(32) DEFAULT 'unknown' NOT NULL,
	"source_artifact_id" text,
	"source_artifact_key" text NOT NULL,
	"title" text,
	"content_type" text,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captured_session_artifacts_kind_check" CHECK ("captured_session_artifacts"."artifact_kind" in ('code', 'file', 'image', 'link', 'attachment', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "captured_session_messages" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"captured_session_id" varchar(32) NOT NULL,
	"provider_id" varchar(32) NOT NULL,
	"source_message_id" text,
	"source_message_key" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"role" varchar(32) DEFAULT 'unknown' NOT NULL,
	"content_text" text,
	"content_json" text,
	"sequence_number" varchar(48) NOT NULL,
	"source_created_at" timestamp with time zone,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captured_session_messages_role_check" CHECK ("captured_session_messages"."role" in ('user', 'assistant', 'system', 'tool', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "captured_session_source_snapshots" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"captured_session_id" varchar(32) NOT NULL,
	"sync_batch_id" varchar(32),
	"provider_id" varchar(32),
	"source_url" text NOT NULL,
	"parser_version" text,
	"snapshot_json" text,
	"file_object_id" varchar(32),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captured_session_source_snapshots_payload_check" CHECK ("captured_session_source_snapshots"."snapshot_json" is not null or "captured_session_source_snapshots"."file_object_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "captured_sessions" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"workspace_slug" varchar(80) NOT NULL,
	"provider_id" varchar(32) NOT NULL,
	"capture_client_id" varchar(32),
	"kind" varchar(32) DEFAULT 'unknown' NOT NULL,
	"source_url" text NOT NULL,
	"source_session_id" text,
	"source_session_key" text NOT NULL,
	"title" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"first_captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captured_sessions_kind_check" CHECK ("captured_sessions"."kind" in ('chat', 'coding', 'agent_run', 'unknown')),
	CONSTRAINT "captured_sessions_status_check" CHECK ("captured_sessions"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "session_capture_sync_batches" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"capture_client_id" varchar(32) NOT NULL,
	"captured_session_id" varchar(32),
	"provider_id" varchar(32),
	"idempotency_key" text NOT NULL,
	"parser_version" text,
	"status" varchar(32) DEFAULT 'accepted' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"artifact_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_capture_sync_batches_status_check" CHECK ("session_capture_sync_batches"."status" in ('accepted', 'rejected', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "session_capture_sync_events" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(32) NOT NULL,
	"capture_client_id" varchar(32),
	"captured_session_id" varchar(32),
	"sync_batch_id" varchar(32),
	"provider_id" varchar(32),
	"status" varchar(32) NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"artifact_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_capture_sync_events_status_check" CHECK ("session_capture_sync_events"."status" in ('accepted', 'rejected', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "capture_clients" ADD CONSTRAINT "capture_clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_clients" ADD CONSTRAINT "capture_clients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_artifacts" ADD CONSTRAINT "captured_session_artifacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_artifacts" ADD CONSTRAINT "captured_session_artifacts_captured_session_id_captured_sessions_id_fk" FOREIGN KEY ("captured_session_id") REFERENCES "public"."captured_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_artifacts" ADD CONSTRAINT "captured_session_artifacts_captured_message_id_captured_session_messages_id_fk" FOREIGN KEY ("captured_message_id") REFERENCES "public"."captured_session_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_artifacts" ADD CONSTRAINT "captured_session_artifacts_file_object_id_file_objects_id_fk" FOREIGN KEY ("file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_messages" ADD CONSTRAINT "captured_session_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_messages" ADD CONSTRAINT "captured_session_messages_captured_session_id_captured_sessions_id_fk" FOREIGN KEY ("captured_session_id") REFERENCES "public"."captured_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_messages" ADD CONSTRAINT "captured_session_messages_provider_id_capture_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."capture_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_source_snapshots" ADD CONSTRAINT "captured_session_source_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_source_snapshots" ADD CONSTRAINT "captured_session_source_snapshots_captured_session_id_captured_sessions_id_fk" FOREIGN KEY ("captured_session_id") REFERENCES "public"."captured_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_source_snapshots" ADD CONSTRAINT "captured_session_source_snapshots_sync_batch_id_session_capture_sync_batches_id_fk" FOREIGN KEY ("sync_batch_id") REFERENCES "public"."session_capture_sync_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_source_snapshots" ADD CONSTRAINT "captured_session_source_snapshots_provider_id_capture_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."capture_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_session_source_snapshots" ADD CONSTRAINT "captured_session_source_snapshots_file_object_id_file_objects_id_fk" FOREIGN KEY ("file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_sessions" ADD CONSTRAINT "captured_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_sessions" ADD CONSTRAINT "captured_sessions_provider_id_capture_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."capture_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_sessions" ADD CONSTRAINT "captured_sessions_capture_client_id_capture_clients_id_fk" FOREIGN KEY ("capture_client_id") REFERENCES "public"."capture_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_batches" ADD CONSTRAINT "session_capture_sync_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_batches" ADD CONSTRAINT "session_capture_sync_batches_capture_client_id_capture_clients_id_fk" FOREIGN KEY ("capture_client_id") REFERENCES "public"."capture_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_batches" ADD CONSTRAINT "session_capture_sync_batches_captured_session_id_captured_sessions_id_fk" FOREIGN KEY ("captured_session_id") REFERENCES "public"."captured_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_batches" ADD CONSTRAINT "session_capture_sync_batches_provider_id_capture_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."capture_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_events" ADD CONSTRAINT "session_capture_sync_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_events" ADD CONSTRAINT "session_capture_sync_events_capture_client_id_capture_clients_id_fk" FOREIGN KEY ("capture_client_id") REFERENCES "public"."capture_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_events" ADD CONSTRAINT "session_capture_sync_events_captured_session_id_captured_sessions_id_fk" FOREIGN KEY ("captured_session_id") REFERENCES "public"."captured_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_events" ADD CONSTRAINT "session_capture_sync_events_sync_batch_id_session_capture_sync_batches_id_fk" FOREIGN KEY ("sync_batch_id") REFERENCES "public"."session_capture_sync_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_capture_sync_events" ADD CONSTRAINT "session_capture_sync_events_provider_id_capture_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."capture_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_clients_token_hash_uq" ON "capture_clients" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "capture_clients_workspace_status_idx" ON "capture_clients" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "capture_providers_provider_key_uq" ON "capture_providers" USING btree ("provider_key");--> statement-breakpoint
CREATE INDEX "capture_providers_status_idx" ON "capture_providers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "captured_session_artifacts_source_key_uq" ON "captured_session_artifacts" USING btree ("captured_session_id","source_artifact_key");--> statement-breakpoint
CREATE INDEX "captured_session_artifacts_message_idx" ON "captured_session_artifacts" USING btree ("captured_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "captured_session_messages_source_key_uq" ON "captured_session_messages" USING btree ("captured_session_id","source_message_key");--> statement-breakpoint
CREATE INDEX "captured_session_messages_session_order_idx" ON "captured_session_messages" USING btree ("captured_session_id","sequence_number");--> statement-breakpoint
CREATE INDEX "captured_session_messages_workspace_idx" ON "captured_session_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "captured_session_source_snapshots_session_created_idx" ON "captured_session_source_snapshots" USING btree ("captured_session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "captured_sessions_workspace_provider_source_uq" ON "captured_sessions" USING btree ("workspace_id","provider_id","source_session_key");--> statement-breakpoint
CREATE INDEX "captured_sessions_workspace_updated_idx" ON "captured_sessions" USING btree ("workspace_id","last_synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_capture_sync_batches_client_key_uq" ON "session_capture_sync_batches" USING btree ("capture_client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "session_capture_sync_batches_workspace_created_idx" ON "session_capture_sync_batches" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "session_capture_sync_events_workspace_created_idx" ON "session_capture_sync_events" USING btree ("workspace_id","created_at");