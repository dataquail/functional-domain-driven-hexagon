import * as Cloudflare from "alchemy/Cloudflare";

export const domainEventsQueue = Cloudflare.Queues.Queue("domain-events");

export const domainEventsDeadLetterQueue = Cloudflare.Queues.Queue("domain-events-dlq");
