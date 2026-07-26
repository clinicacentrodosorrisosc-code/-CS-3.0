const fs = require('fs');
let content = fs.readFileSync('src/crm/lib/whatsapp/send-message.ts', 'utf8');
content = content.replace(/updated_at: new Date\(\)\.toISOString\(\),\n    }\)/g, "updated_at: new Date().toISOString(),\n    })\n    .eq('id', conversationId);");
content = content.replace(/if \(pauseErr\) {\n    }/g, "if (pauseErr) {\n      console.warn('Failed to pause flow runs', pauseErr);\n    }");
content = content.replace(/console\.error\(\n      '\[flows\] pause-on-agent-send threw:',\n      err instanceof Error \? err\.message : err/g, "console.error(\n      '[flows] pause-on-agent-send threw:',\n      err instanceof Error ? err.message : err\n    );");
content = content.replace(/\.select\(\)/g, ".select();");
fs.writeFileSync('src/crm/lib/whatsapp/send-message.ts', content);
