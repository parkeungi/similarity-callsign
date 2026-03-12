// Supabase 클라이언트 초기화 - createClient(SUPABASE_URL, SUPABASE_ANON_KEY), 스토리지/실시간 기능용
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
}

export const supabaseClient = createClient(url, anonKey);
