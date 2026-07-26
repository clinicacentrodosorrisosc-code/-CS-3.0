import fs from 'fs';
const file = 'src/crm/components/inbox/conversation-list.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        
        // Handle missing table specifically
        if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
           setLoading(false);
           onConversationsLoadedRef.current([]); // Clear list
           return;
        }`;

const replacement = `      if (error) {
        // Handle missing table specifically
        if (
          (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
          (error.message?.includes("Could not find the table") && error.message?.includes("schema cache"))
        ) {
           setLoading(false);
           onConversationsLoadedRef.current([]); // Clear list
           return;
        }

        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Patched conversation-list.tsx');
} else {
  console.log('Target not found in conversation-list.tsx');
}
