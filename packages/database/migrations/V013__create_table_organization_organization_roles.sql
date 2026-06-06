CREATE TABLE "organization"."organization_roles" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"issued_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("organization_id", "user_id", "role"),
	CONSTRAINT "organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE,
	CONSTRAINT "organization_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE CASCADE,
	CONSTRAINT "organization_roles_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "user"."users"("id") ON DELETE RESTRICT
);

CREATE INDEX "organization_roles_user_id_organization_id_idx" ON "organization"."organization_roles"("user_id", "organization_id");
