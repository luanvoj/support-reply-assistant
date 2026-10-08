import { db } from "@/lib/db";
import { claimNextMergeBatch, runClaimedMergeBatch } from "@/lib/knowledge/merge-batch";

const drain = process.argv.includes("--drain");
const workerId = `cli-${process.pid}-${Date.now()}`;

async function main() {
  let processed = 0;
  do {
    const batchId = await claimNextMergeBatch(workerId);
    if (!batchId) break;
    try {
      await runClaimedMergeBatch(batchId, workerId);
      console.log(`Merge batch ${batchId} is ready for review.`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "MERGE_SCAN_FAILED";
      console.error(`Merge batch ${batchId}: ${code}`);
    }
    processed += 1;
  } while (drain && processed < 10);
  console.log(`Processed ${processed} merge batch(es).`);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
