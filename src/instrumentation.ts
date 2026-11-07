/**
 * Runs once when the server boots: apply migrations, and in demo mode seed an empty
 * database so the app is usable immediately.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootNode } = await import("./instrumentation-node");
    await bootNode();
  }
}
