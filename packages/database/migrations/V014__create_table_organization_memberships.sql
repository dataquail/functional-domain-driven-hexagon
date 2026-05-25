CREATE TABLE "organization"."memberships" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "memberships_pkey" PRIMARY KEY ("user_id", "organization_id"),
	CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE CASCADE,
	CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "memberships_organization_id_idx" ON "organization"."memberships"("organization_id");
