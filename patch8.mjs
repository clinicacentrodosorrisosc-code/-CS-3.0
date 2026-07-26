import fs from 'fs';
const file = 'src/crm/components/presence/presence-heartbeat.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (error && !cancelled) {
        // Non-fatal: presence is best-effort. Log once per failure so a
        // misconfigured RPC is visible without spamming.
        console.error("[PresenceHeartbeat] touch_presence failed:", error.message);
      }`;

const replacement = `      if (error && !cancelled) {
        if (
          error.message?.includes("Could not find the function") && 
          error.message?.includes("schema cache")
        ) {
          // Ignore missing function during initial setup
          return;
        }
        // Non-fatal: presence is best-effort. Log once per failure so a
        // misconfigured RPC is visible without spamming.
        console.error("[PresenceHeartbeat] touch_presence failed:", error.message);
      }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched presence-heartbeat.tsx');
} else {
  console.log('Target not found in presence-heartbeat.tsx');
}
