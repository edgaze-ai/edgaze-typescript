// Starts a run and prints its output live.
//   EDGAZE_API_KEY=… npx tsx examples/run-and-stream.ts <workflow-id> '{"topic":"Tides"}'
import Edgaze from "../src/index.js";

const [workflow, inputsJson = "{}"] = process.argv.slice(2);
if (!workflow) throw new Error("Usage: run-and-stream.ts <workflow-id> [inputs-json]");

const client = new Edgaze();
const { run } = await client.runs.create({ workflow, inputs: JSON.parse(inputsJson) });
console.log(`Run ${run.id} accepted`);

for await (const message of client.runs.stream(run.id)) {
  if (message.kind === "snapshot") continue;
  const { event } = message;
  if (event.type === "node.output.delta") process.stdout.write(event.data?.text ?? "");
  else if (event.status)
    console.log(`\n[${event.status}]${event.reason ? ` ${event.reason}` : ""}`);
}

const finished = await client.runs.retrieve(run.id);
console.log("Outputs:", JSON.stringify(finished.outputs, null, 2));
console.log("Charged:", finished.displayedChargeUsd ?? "pending", "USD");
