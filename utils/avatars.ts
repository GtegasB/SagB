
// --- BANCO DE AVATARES (CORPORATE STYLE) ---
// Fonte: Unsplash (Permissive Hotlinking)

const MALE_AVATARS = [
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200&h=200", // Male 1 (Suit)
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200", // Male 2 (Casual)
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200&h=200", // Male 3 (Executive)
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200", // Male 4
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200", // Male 5
    "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?auto=format&fit=crop&q=80&w=200&h=200"  // Male 6
];

const FEMALE_AVATARS = [
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200", // Female 1 (Executive)
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200", // Female 2 (Smile)
    "https://images.unsplash.com/photo-1598550874175-4d71156852fd?auto=format&fit=crop&q=80&w=200&h=200", // Female 3
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200&h=200", // Female 4
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=200&h=200", // Female 5
    "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=200&h=200"  // Female 6
];

// Map de Avatares Oficiais (Substituídos por versões estáveis)
const KNOWN_AVATARS: Record<string, string> = {
    'Douglas Rodrigues': "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FScreenshot_79.png?alt=media&token=1b6c2884-ae4d-49de-9d03-f0a38e0cfc27", 
    'Pietro Carboni': "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FPietro%20Carboni%20Foto%20Avatar.png?alt=media&token=082e13ca-7cc8-4316-bd9e-24af3b08deb2",    
    'Zara Bittencourt': "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200",  // Placeholder Zara (CEO)
    'Tulian Zagoto': "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200"     // Placeholder Tulian
};

export const getAvatarForAgent = (name: string): string => {
    if (!name) return MALE_AVATARS[0];

    // 1. Verifica Oficial
    if (KNOWN_AVATARS[name]) return KNOWN_AVATARS[name];

    // 2. Detecta Gênero (Heurística Simples)
    const firstName = name.split(' ')[0].toLowerCase();
    const isFemale = firstName.endsWith('a') || firstName.endsWith('e') || 
                     ['yasmin', 'karen', 'tânia', 'raquel', 'beatriz', 'liz', 'isabel', 'pietra'].includes(firstName);

    // 3. Seleção Determinística (Hash based)
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash);

    // 4. Retorna do Pool
    const pool = isFemale ? FEMALE_AVATARS : MALE_AVATARS;
    return pool[index % pool.length];
};