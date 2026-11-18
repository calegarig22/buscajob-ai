// Migração única: single-user -> multiusuário. Uso: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/migrate-multiuser.mjs
import { neon } from "@neondatabase/serverless";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
const pw = process.env.ADMIN_PASSWORD;
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 64).toString("base64")}`;

const [{ exists }] = await sql`select to_regclass('public.users') is not null as exists`;
if (exists) { console.log("users já existe: migração já aplicada."); process.exit(0); }
const [p] = await sql`select data->>'nome' as nome from profile limit 1`;
const id = randomUUID();
const name = p?.nome || "Admin";

await sql.transaction([
  sql`create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null constraint users_email_unique unique,
    name text not null,
    password_hash text not null,
    role text not null default 'user',
    session_version integer not null default 1,
    terms_accepted_at timestamp,
    created_at timestamp not null default now())`,
  sql`create table invites (
    token_hash text primary key,
    kind text not null,
    email text,
    user_id uuid constraint invites_user_id_users_id_fk references users(id) on delete cascade,
    created_by uuid constraint invites_created_by_users_id_fk references users(id) on delete set null,
    note text,
    expires_at timestamp not null,
    used_at timestamp,
    created_at timestamp not null default now())`,
  sql`insert into users (id, email, name, password_hash, role, terms_accepted_at) values (${id}, ${email}, ${name}, ${hash}, 'admin', now())`,
  // profile: id=1 -> user_id
  sql`alter table profile add column user_id uuid`,
  sql`alter table profile add column last_run_at timestamp`,
  sql`update profile set user_id = ${id}`,
  sql`alter table profile drop constraint profile_pkey`,
  sql`alter table profile drop column id`,
  sql`alter table profile add constraint profile_pkey primary key (user_id)`,
  sql`alter table profile add constraint profile_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade`,
  // sources
  sql`alter table sources add column user_id uuid`,
  sql`update sources set user_id = ${id}`,
  sql`alter table sources alter column user_id set not null`,
  sql`alter table sources add constraint sources_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade`,
  sql`create unique index sources_user_kind_slug on sources (user_id, kind, slug)`,
  // jobs
  sql`alter table jobs add column user_id uuid`,
  sql`update jobs set user_id = ${id}`,
  sql`alter table jobs alter column user_id set not null`,
  sql`alter table jobs drop constraint jobs_pkey`,
  sql`alter table jobs add constraint jobs_user_id_id_pk primary key (user_id, id)`,
  sql`alter table jobs add constraint jobs_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade`,
]);
const [c] = await sql`select (select count(*) from users) u, (select count(*) from profile where user_id is not null) p, (select count(*) from sources where user_id=${id}) s, (select count(*) from jobs) j`;
console.log("ok:", { admin: email, nome: name, ...c });
