CREATE TABLE "auth"."api_tokens" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL REFERENCES "user"."users"("id") ON DELETE CASCADE,
	-- sha256(token) hex. The plaintext token is shown to the caller exactly
	-- once at mint time and never stored; lookups hash the presented bearer
	-- and match against this column.
	"token_hash" text NOT NULL UNIQUE,
	-- Non-secret display fragment (e.g. `pat_1a2b3c4d`) so the owner can tell
	-- their tokens apart in a listing without exposing the secret.
	"prefix" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	-- Fixed expiry (NOT sliding): a token expires at a wall-clock instant
	-- regardless of use. Nullable to leave room for non-expiring tokens later;
	-- the mint path always sets it in v1.
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_used_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "api_tokens_user_id_idx" ON "auth"."api_tokens"("user_id");
