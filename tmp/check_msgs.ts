import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .schema('cuca')
      .from('mensagens')
      .select('men_id, men_papel, men_status, men_conteudo, men_modelo')
      .order('men_criado_em', { ascending: false })
      .limit(10);

    if (error) {
      console.error(error);
    } else {
      console.log('Last 10 messages:');
      data.forEach(m => {
        console.log(`[${m.men_id}] ${m.men_papel} (${m.men_status}): ${m.men_conteudo ? m.men_conteudo.substring(0, 50) + '...' : 'EMPTY'}`);
      });
    }
  } catch (err) {
    console.error(err);
  }
}
run();
