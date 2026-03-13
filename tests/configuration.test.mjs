import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const readFile = (relativePath) => {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

test('env example contains required keys and no merge markers', () => {
  const content = readFile('.env.example');
  assert.ok(content.includes('VITE_SUPABASE_URL='));
  assert.ok(content.includes('VITE_SUPABASE_ANON_KEY='));
  assert.ok(content.includes('GEMINI_API_KEY='));
  assert.ok(content.includes('DEEPSEEK_API_KEY='));
  assert.ok(!content.includes('<<<<<<<'));
  assert.ok(!content.includes('>>>>>>>'));
});

test('workflow deploy file has no merge conflict markers', () => {
  const content = readFile('.github/workflows/deploy.yml');
  assert.ok(!content.includes('<<<<<<<'));
  assert.ok(!content.includes('>>>>>>>'));
});

test('deepseek service does not hardcode API keys', () => {
  const content = readFile('services/deepseek.ts');
  assert.ok(!/sk-[a-z0-9]{20,}/i.test(content));
  assert.ok(content.includes("callAiProxy<{ text: string }>('deepseek_chat'"));
});

test('gemini service routes chat calls via AI proxy', () => {
  const content = readFile('services/gemini.ts');
  assert.ok(content.includes("callAiProxy<{ text: string }>('gemini_chat'"));
});

test('netlify AI function exists and exposes action handlers', () => {
  const content = readFile('netlify/functions/ai.mjs');
  assert.ok(content.includes('const actionHandlers = {'));
  assert.ok(content.includes('gemini_chat: handleGeminiChat'));
  assert.ok(content.includes('deepseek_chat: handleDeepSeekChat'));
});

test('programmers room module is wired into the SagB shell', () => {
  const app = readFile('App.tsx');
  const sidebar = readFile('components/Sidebar.tsx');
  const view = readFile('components/ProgrammersRoomView.tsx');

  assert.ok(app.includes("case 'programmers-room'"));
  assert.ok(sidebar.includes("id: 'programmers-room'"));
  assert.ok(view.includes('Sala dos Programadores'));
  assert.ok(view.includes('Definition of Done'));
});

test('radar de conexoes module is wired into the SagB shell', () => {
  const app = readFile('App.tsx');
  const sidebar = readFile('components/Sidebar.tsx');
  const nagi = readFile('components/NAGIView.tsx');
  const view = readFile('components/RadarConnectionsView.tsx');
  const doc = readFile('docs/Estrutura_SagB/Radar_de_Conexoes');

  assert.ok(app.includes("case 'radar-connections'"));
  assert.ok(sidebar.includes("id: 'radar-connections'"));
  assert.ok(nagi.includes("routeTab: 'radar-connections'"));
  assert.ok(view.includes('Radar de Conexoes'));
  assert.ok(doc.includes('Especificacao Canonica do Projeto'));
});

test('sagb bridge database foundation migration exists', () => {
  const content = readFile('supabase/migrations/20260313_sagb_bridge_core.sql');
  assert.ok(content.includes('create table if not exists public.dev_projects'));
  assert.ok(content.includes('create table if not exists public.dev_tasks'));
  assert.ok(content.includes('create table if not exists public.dev_task_runs'));
  assert.ok(content.includes('create table if not exists public.dev_task_launches'));
});

test('nagi radar database foundation migration exists', () => {
  const content = readFile('supabase/migrations/20260313_nagi_radar_core.sql');
  assert.ok(content.includes('create table if not exists public.nagi_ecosystem_entities'));
  assert.ok(content.includes('create table if not exists public.nagi_entity_relations'));
  assert.ok(content.includes('create table if not exists public.nagi_external_signals'));
  assert.ok(content.includes('create table if not exists public.nagi_insight_distributions'));
  assert.ok(content.includes('create table if not exists public.nagi_ecosystem_decisions'));
});
