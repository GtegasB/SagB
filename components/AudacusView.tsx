
import React, { useState, useEffect } from 'react';
import { BusinessUnit } from '../types';

interface AudacusViewProps {
  activeBU: BusinessUnit;
  onBack?: () => void;
}

const AudacusView: React.FC<AudacusViewProps> = ({ activeBU, onBack }) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);

  useEffect(() => {
    // Recupera link salvo ou usa o padrão do sistema (Hardcoded para Audacus)
    const savedUrl = localStorage.getItem(`grupob_gateway_${activeBU.id}`);
    
    // Protocolo de Conexão Direta: Audacus
    const defaultUrl = activeBU.id === 'audacus' 
      ? 'https://audacus-64246262651.us-west1.run.app/' 
      : '';

    if (savedUrl) {
      setTargetUrl(savedUrl);
      setIsConfiguring(false);
    } else if (defaultUrl) {
      // Auto-conexão para unidades conhecidas
      setTargetUrl(defaultUrl);
      localStorage.setItem(`grupob_gateway_${activeBU.id}`, defaultUrl);
      setIsConfiguring(false);
    } else {
      setIsConfiguring(true);
    }
  }, [activeBU.id]);

  const handleSaveUrl = () => {
    if (targetUrl.trim()) {
      localStorage.setItem(`grupob_gateway_${activeBU.id}`, targetUrl);
      setIsConfiguring(false);
      setIsLoadingIframe(true);
    }
  };

  const handleChangeUrl = () => {
    setIsConfiguring(true);
  };

  // Modo Configuração (Tela Escura Gateway) - Só aparece se não houver URL definida
  if (isConfiguring) {
    return (
      <div className="flex-1 h-full bg-[#0F172A] flex flex-col items-center justify-center p-12 font-nunito animate-msg relative overflow-hidden">
        {/* Background Tech Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/20 rounded-full blur-[120px]"></div>
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-blue-500/20 to-transparent"></div>
        </div>

        {onBack && (
          <button 
             onClick={onBack}
             className="absolute top-8 left-8 text-white/40 hover:text-white transition-colors flex items-center gap-2 z-50"
          >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
             <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
          </button>
        )}

        <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-black text-3xl shadow-[0_0_50px_rgba(30,27,75,0.5)] mb-6 border border-white/10" style={{ backgroundColor: activeBU.themeColor }}>
             <span className="text-white drop-shadow-md">A</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">
            Integração {activeBU.name}
          </h1>
          <p className="text-blue-200/60 font-bold uppercase tracking-[0.3em] text-[10px] mb-10">
            Configure o endpoint da aplicação externa
          </p>

          <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-10 shadow-2xl animate-msg">
            <label className="text-[9px] font-black text-blue-300 uppercase tracking-widest block mb-4 text-left">
              URL da Aplicação (Embed)
            </label>
            <div className="flex gap-4">
              <input 
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://sua-aplicacao-audacus.vercel.app"
                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-white/20"
              />
              <button 
                onClick={handleSaveUrl}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Conectar
              </button>
            </div>
            <p className="text-[9px] text-white/30 mt-4 text-left leading-relaxed">
              *Certifique-se que a aplicação de destino permite conexão via iframe (X-Frame-Options).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Modo Embarcado (Iframe Fullscreen)
  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 relative overflow-hidden animate-msg">
      {/* Toolbar de Controle Superior */}
      <div className="h-10 bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0 z-20 shadow-sm">
         <div className="flex items-center gap-4">
            {onBack && (
              <button 
                 onClick={onBack}
                 className="flex items-center gap-1.5 text-gray-400 hover:text-bitrix-nav transition-colors"
                 title="Voltar ao Hub"
              >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
                 <span className="text-[9px] font-black uppercase tracking-widest">GrupoB</span>
              </button>
            )}
            <div className="h-4 w-px bg-gray-200"></div>
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isLoadingIframe ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate max-w-[300px]">
                 {targetUrl}
               </span>
            </div>
         </div>
         <button 
           onClick={handleChangeUrl}
           className="text-[9px] font-black text-bitrix-nav hover:text-bitrix-accent uppercase tracking-widest transition-colors flex items-center gap-2"
         >
           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
           Reconfigurar
         </button>
      </div>

      {/* Área de Embed */}
      <div className="flex-1 relative w-full h-full bg-white">
        {isLoadingIframe && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-0">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-bitrix-nav rounded-full animate-spin mb-4"></div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Estabelecendo Link Seguro com Audacus...</span>
           </div>
        )}
        <iframe 
          src={targetUrl} 
          className="absolute inset-0 w-full h-full border-0 z-10"
          onLoad={() => setIsLoadingIframe(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          title={`Audacus - ${activeBU.name}`}
        />
      </div>
    </div>
  );
};

export default AudacusView;
