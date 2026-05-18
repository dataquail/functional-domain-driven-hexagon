CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL REFERENCES "user"."users"("id") ON DELETE CASCADE,
	"subject" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_used_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "auth"."sessions"("expires_at");
