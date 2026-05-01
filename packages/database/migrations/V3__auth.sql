CREATE TABLE "auth_identities" (
	"subject" varchar(128) PRIMARY KEY,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"provider" varchar(32) NOT NULL DEFAULT 'zitadel',
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"subject" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_used_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
