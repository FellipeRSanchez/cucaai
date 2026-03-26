
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  try {
    const { data, error } = await supabase
      .schema('cuca')
      .from('mensagens')
      .select('men_id, men_status, men_job_id')
      .limit(1);

    if (error) {
       console.error('DATABASE_ERROR:', error.message);
    } else {
       console.log('SUCCESS: Columns exist.');
    }
  } catch (err) {
    console.error('UNEXPECTED_ERROR:', err.message);
  }
}

test();
