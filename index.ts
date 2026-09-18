// Supabase Edge Function: create-setup-intent
//
// Creates a Stripe Customer (tagged with the VIG reference so you can find
// them later) and a SetupIntent, which lets the browser save a card WITHOUT
// charging it. That's the whole job — Stripe stores the saved card against
// the Customer automatically once the SetupIntent is confirmed, so there's
// nothing else to wire up. Deploy with:
//
//   supabase functions deploy create-setup-intent
//
// Required secret (set once):
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...

import Stripe from "npm:stripe@14.25.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

// Tighten this to your GitHub Pages origin once the page is live, e.g.
// "https://robertpersell-spec.github.io"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { vigReference, name, email, phone, journey } = await req.json();

    if (!vigReference || !name || !email) {
      return new Response(
        JSON.stringify({ error: "vigReference, name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // journey is optional free text (e.g. "LHR T5 -> Mayfair, 12 Oct") —
    // stored as metadata so it shows on the customer record in Stripe,
    // making it easier to identify the right booking when you charge later.
    const customer = await stripe.customers.create({
      name,
      email,
      phone,
      metadata: { vig_reference: vigReference, journey: journey || "" },
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { vig_reference: vigReference },
    });

    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
