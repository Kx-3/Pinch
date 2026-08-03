import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Webhook secret missing", { status: 500 });
    }

    const svix_id = request.headers.get("svix-id");
    const svix_signature = request.headers.get("svix-signature");
    const svix_timestamp = request.headers.get("svix-timestamp");

    if (!svix_id || !svix_signature || !svix_timestamp) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const payload = await request.text();
    const wh = new Webhook(webhookSecret);
    let evt: any;
    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      return new Response("Invalid signature", { status: 400 });
    }

    const eventType = evt.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses[0]?.email_address ?? "";
      const name = `${first_name ?? ""} ${last_name ?? ""}`.trim();

      await ctx.runMutation(internal.functions.users.upsertFromClerk, {
        clerkUserId: id,
        email,
        name,
      });
    } else if (eventType === "user.deleted") {
      const { id } = evt.data;
      if (id) {
        await ctx.runMutation(internal.functions.users.deleteFromClerk, {
          clerkUserId: id,
        });
      }
    }
    return new Response("OK", { status: 200 });
  }),
});

export default http;
