CREATE TABLE "platform"."roles" (
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_pkey" PRIMARY KEY ("user_id", "role"),
	CONSTRAINT "roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
