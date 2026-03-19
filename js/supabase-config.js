// ============================================================
// Supabase Configuration
// ============================================================
// Replace these with your actual Supabase project values.
// The anon key is designed to be public (RLS policies protect
// your data), so it's safe to commit this file.
//
// 1. Go to https://supabase.com and create a free project
// 2. Go to Project Settings > API
// 3. Copy the "Project URL" and "anon public" key below
// ============================================================

const SUPABASE_URL = 'https://pwmrbmjlgweahridxvgk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hl85SOTn2XIl2eV5noeZww_CDKjaLVT';

// ============================================================
// Password hash — SHA-256 of your chosen password.
//
// To generate your hash, open your browser console and run:
//
//   async function hashPassword(pw) {
//     const data = new TextEncoder().encode(pw);
//     const hash = await crypto.subtle.digest('SHA-256', data);
//     return Array.from(new Uint8Array(hash))
//       .map(b => b.toString(16).padStart(2, '0')).join('');
//   }
//   hashPassword('your-password-here').then(console.log);
//
// Then paste the resulting hex string below.
// ============================================================

const PASSWORD_HASH = '9366e2197ac34e6bb9ca7e958a0250a119d3cb38ccd74f8a3439f262256bdb4b';
