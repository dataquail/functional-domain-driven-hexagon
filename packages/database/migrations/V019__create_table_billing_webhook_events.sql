CREATE TABLE "billing"."webhook_events" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
