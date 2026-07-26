const fs = require('fs');
let content = fs.readFileSync('src/crm/lib/whatsapp/send-message.ts', 'utf8');
content = content.replace(/400\n  \}/g, '400\n    );\n  }');
content = content.replace(/500\n  \}/g, '500\n    );\n  }');
content = content.replace(/400\s*\n  \}/g, '400\n    );\n  }');
content = content.replace(/500\s*\n  \}/g, '500\n    );\n  }');
fs.writeFileSync('src/crm/lib/whatsapp/send-message.ts', content);
