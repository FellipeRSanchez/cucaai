
import { getServiceSupabase } from './src/lib/supabase.ts';

async function checkSchema() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .rpc('get_table_info', { table_name: 'mensagens', table_schema: 'cuca' });
  
  // Alternative: try to select the new column
  const { error: testError } = await supabase
    .schema('cuca')
    .from('mensagens')
    .select('men_status')
    .limit(1);

  if (testError) {
    console.log('Error accessing men_status:', testError.message);
    if (testError.message.includes('column "men_status" does not exist')) {
      console.log('SQL MIGRATION PENDING');
    }
  } else {
    console.log('men_status exists!');
  }
}

checkSchema();
