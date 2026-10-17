import esbuild from "esbuild";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import builtins from "builtin-modules";

const tmp = mkdtempSync(join(tmpdir(), "vault-agents-test-"));
const outfile = join(tmp, "suite.test.cjs");

try {
  await esbuild.build({
    entryPoints: ["test/suite.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: [...builtins, ...builtins.map((b) => `node:${b}`)],
    outfile,
    logLevel: "warning",
  });

  const res = spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  process.exitCode = res.status ?? 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
