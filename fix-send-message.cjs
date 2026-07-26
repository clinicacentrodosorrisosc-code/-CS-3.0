const fs = require('fs');
let content = fs.readFileSync('src/crm/lib/whatsapp/send-message.ts', 'utf8');

// The sed command deleted lines that contained `);` which broke the file.
// We can see what it's supposed to look like based on typical TS syntax.
content = content.replace(/400\s*\n\s*\}/g, '400\n    );\n  }');
content = content.replace(/500\s*\n\s*\}/g, '500\n    );\n  }');
content = content.replace(/502\s*\n\s*\}/g, '502\n    );\n  }');
content = content.replace(/if \(!messageType\) {\n  }/g, 'if (!messageType) {\n    throw new SendMessageError(\'bad_request\', \'message_type is required\', 400);\n  }');
content = content.replace(/\.eq\('account_id', accountId\)\n  if \(convError/g, '.eq(\'account_id\', accountId)\n    .single();\n\n  if (convError');
content = content.replace(/if \(convError \|\| !conversation\) {\n  }/g, 'if (convError || !conversation) {\n    throw new SendMessageError(\'bad_request\', \'Conversation not found\', 400);\n  }');
content = content.replace(/const sanitizedPhone/g, 'const sanitizedPhone = sanitizePhoneForMeta(contact.phone);\n  const isMediaKind = MEDIA_KINDS.includes(messageType as any);\n  const accessToken = decrypt(config.access_token);\n  const variants = phoneVariants(sanitizedPhone);\n\n  const sanitizedPhone'); // wait, that won't work perfectly.
fs.writeFileSync('src/crm/lib/whatsapp/send-message.ts.fixed', content);
