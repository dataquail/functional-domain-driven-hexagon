CREATE TABLE "auth"."device_grants" (
	"id" uuid PRIMARY KEY,
	-- sha256(device_code) hex. The CLI holds the plaintext device_code; the
	-- poll endpoint hashes the presented value and matches against this.
	"device_code_hash" text NOT NULL UNIQUE,
	-- Short, human-typable code the user enters in the browser (e.g. ABCD-1234).
	"user_code" varchar(32) NOT NULL UNIQUE,
	-- 'pending' until the browser approves, then 'approved'.
	"status" varchar(16) NOT NULL DEFAULT 'pending',
	-- Null until approved; set to the approving user on approval.
	"user_id" uuid REFERENCES "user"."users"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	-- Short TTL (~10 min). A lapsed grant is rejected and swept later.
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone
);

CREATE INDEX "device_grants_user_code_idx" ON "auth"."device_grants"("user_code");
