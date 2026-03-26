import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .schema('cuca')
    .from('mensagens')
    .select('men_id, men_papel, men_conteudo, men_status, men_modelo, men_job_id, men_criado_em')
    .order('men_criado_em', { ascending: false })
    .limit(10);

  if (error) console.error(error);
  else console.table(data);
}
check();
