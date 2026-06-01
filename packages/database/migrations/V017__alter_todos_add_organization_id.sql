ALTER TABLE "todos"."todos"
	ADD COLUMN "organization_id" uuid NOT NULL
	REFERENCES "organization"."organizations"("id") ON DELETE CASCADE;

CREATE INDEX "todos_organization_id_idx" ON "todos"."todos"("organization_id");
