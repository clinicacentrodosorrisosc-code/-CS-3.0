import fs from 'fs';
const event = JSON.parse(fs.readFileSync('sample-event.json', 'utf8'));
const fieldId = 334682;

const afterVal = (event.value_after?.find(v => Number(v.custom_field_value?.field_id || v.custom_field_id || v.field_id) === Number(fieldId))) ||
                 (event.params?.custom_fields?.find(cf => Number(cf.id || cf.field_id) === Number(fieldId)));
                 
const val = afterVal?.custom_field_value?.text || afterVal?.custom_field_value?.value || afterVal?.values?.[0]?.value || afterVal?.value;

console.log("afterVal:", afterVal);
console.log("val:", val);
