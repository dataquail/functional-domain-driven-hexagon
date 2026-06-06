CREATE TABLE "organization"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invitee_email" varchar(320) NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE,
	CONSTRAINT "invitations_token_unique" UNIQUE ("token")
);

CREATE INDEX "invitations_organization_id_idx" ON "organization"."invitations"("organization_id");
CREATE INDEX "invitations_invitee_email_idx" ON "organization"."invitations"("invitee_email");
