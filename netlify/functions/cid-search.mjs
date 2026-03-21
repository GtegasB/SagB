
import { createClient } from '@supabase/supabase-js';

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(payload),
});

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or service role key is missing.');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

const toLabel = (value) => {
    // Simple version of the frontend helper
    return String(value || '').replace(/_/g, ' ');
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { searchText, workspaceId } = payload;
  if (!searchText || !workspaceId) {
    return json(400, { ok: false, error: 'Missing searchText or workspaceId' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const query = `'${searchText.replace(/'/g, "''")}'`; // Basic sanitation for tsquery

  try {
    // Usamos textSearch que é otimizado para full-text search.
    // Precisamos de múltiplas queries e depois juntar os resultados.

    // 1. Buscar em Ativos (títulos)
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from('cid_assets')
      .select('id, title, created_at')
      .eq('workspace_id', workspaceId)
      .textSearch('title', query, { config: 'portuguese', type: 'websearch' });
    if (assetsError) throw assetsError;

    // 2. Buscar em Chunks (conteúdo)
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('cid_chunks')
      .select('asset_id, chunk_index, created_at, text_content')
      .eq('workspace_id', workspaceId)
      .textSearch('text_content', query, { config: 'portuguese', type: 'websearch' });
    if (chunksError) throw chunksError;

    // 3. Buscar em Outputs (resumos, etc)
    const { data: outputs, error: outputsError } = await supabaseAdmin
      .from('cid_outputs')
      .select('asset_id, output_type, created_at, content_text')
      .eq('workspace_id', workspaceId)
      .textSearch('content_text', query, { config: 'portuguese', type: 'websearch' });
    if (outputsError) throw outputsError;

    // Precisamos dos títulos dos assets para os chunks e outputs
    const allAssetIds = [
        ...new Set([
            ...chunks.map(c => c.asset_id),
            ...outputs.map(o => o.asset_id)
        ])
    ];

    let assetTitleMap = new Map();
    if (allAssetIds.length > 0) {
        const { data: relatedAssets, error: relatedAssetsError } = await supabaseAdmin
            .from('cid_assets')
            .select('id, title')
            .in('id', allAssetIds);
        if (relatedAssetsError) throw relatedAssetsError;
        relatedAssets.forEach(a => assetTitleMap.set(a.id, a.title));
    }
     assets.forEach(a => assetTitleMap.set(a.id, a.title));

    // 4. Normalizar e juntar os resultados
    const results = [];

    assets.forEach(asset => {
        results.push({
            assetId: asset.id,
            assetTitle: asset.title,
            source: 'título do ativo',
            createdAt: asset.created_at,
            text: asset.title, // O texto do resultado é o próprio título
        });
    });

    chunks.forEach(chunk => {
        results.push({
            assetId: chunk.asset_id,
            assetTitle: assetTitleMap.get(chunk.asset_id) || 'Título não encontrado',
            source: `parte:${chunk.chunk_index}`,
            createdAt: chunk.created_at,
            text: chunk.text_content,
        });
    });

    outputs.forEach(output => {
        results.push({
            assetId: output.asset_id,
            assetTitle: assetTitleMap.get(output.asset_id) || 'Título não encontrado',
            source: `saída:${toLabel(output.output_type)}`,
            createdAt: output.created_at,
            text: output.content_text,
        });
    });

    // 5. Ordenar por data (mais recentes primeiro) e limitar
    const sortedResults = results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const finalResults = sortedResults.slice(0, 100); // Limita a 100 resultados

    return json(200, { ok: true, data: finalResults });

  } catch (error) {
    console.error('[CID Search] Falha na busca:', error);
    return json(500, { ok: false, error: error.message || 'Internal Server Error' });
  }
}
