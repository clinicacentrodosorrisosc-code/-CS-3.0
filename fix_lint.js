const fs = require('fs');
let code = fs.readFileSync('src/components/ClinicIdeas.tsx', 'utf8');
code = code.replace(/import \{ supabase \} from '\.\.\/supabaseClient';\n/, '');
fs.writeFileSync('src/components/ClinicIdeas.tsx', code);
