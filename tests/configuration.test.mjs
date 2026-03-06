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
