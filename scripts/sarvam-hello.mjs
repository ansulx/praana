// Smoke test: one Sarvam chat completion. Run: npm run sarvam:hello
import { SarvamAIClient } from "sarvamai";

const apiSubscriptionKey = process.env.SARVAM_API_KEY;
if (!apiSubscriptionKey) {
  console.error("SARVAM_API_KEY is not set — add it to .env.local");
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey });
const res = await client.chat.completions({
  model: "sarvam-105b-conversations",
  messages: [{ role: "user", content: "नमस्ते! Reply with one short friendly greeting." }],
});
console.log(res.choices[0].message.content);
