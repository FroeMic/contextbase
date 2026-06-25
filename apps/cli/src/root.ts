import { Command } from "@commander-js/extra-typings"

export function createRootCommand() {
  return new Command()
    .name("contextbase")
    .description("Operate Contextbase from the command line")
    .option("--json", "Output JSON")
    .option("--compact", "Output compact JSON")
    .option("--select <fields>", "Comma-separated fields to include in output")
    .option("--quiet", "Only print the most important value")
    .option("--dry-run", "Validate and print the request without sending it")
    .option("--agent", "Use agent-friendly defaults")
    .option("--api-url <url>", "Contextbase API URL")
    .option("--token <token>", "Contextbase API token")
}
