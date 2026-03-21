
import React from 'react';

const CircuitB: React.FC = () => {
  return (
    <div className="flex-1 h-full bg-[#0a0a0a] overflow-hidden flex flex-col p-12 relative">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">CIRCUITO GrupoB</h1>
        <p className="text-bitrix-accent text-[10px] font-bold uppercase tracking-[0.4em] mt-2">Funil de Inteligência Master</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {/* Camada 1: Direção */}
        <div className="w-[300px] p-6 bg-bitrix-accent/20 border border-bitrix-accent/40 rounded-3xl text-center shadow-[0_0_30px_rgba(128,0,128,0.2)] animate-msg">
          <span className="text-[9px] font-black text-bitrix-accent uppercase tracking-widest block mb-2">Input Nível 01</span>
          <h3 className="text-white font-black uppercase text-xl">Direção Estratégica</h3>
          <p className="text-white/40 text-[10px] mt-2 italic">A Ordem Bruta</p>
        </div>

        {/* Linha de Conexão */}
        <div className="w-0.5 h-12 bg-gradient-to-b from-bitrix-accent to-white/10"></div>

        {/* Camada 2: Constituição */}
        <div className="w-[400px] p-8 bg-white/5 border border-white/10 rounded-[40px] text-center relative group overflow-hidden animate-msg">
          <div className="absolute inset-0 bg-bitrix-accent/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">Filtro de Governança</span>
          <h3 className="text-white font-black uppercase text-2xl tracking-tighter">CONSTITUIÇÃO GRUPOB</h2>
          <div className="flex justify-center gap-4 mt-4">
             {['TOM BOARDROOM', 'SECO', 'SEM ROBÔS'].map(t => (
               <span key={t} className="text-[8px] bg-white/10 text-white/60 px-2 py-1 rounded-full">{t}</span>
             ))}
          </div>
        </div>

        {/* Linha de Conexão */}
        <div className="w-0.5 h-12 bg-gradient-to-b from-white/10 to-purple-500"></div>

        {/* Camada 3: DNA Tático */}
        <div className="w-[350px] p-6 bg-purple-500/10 border border-purple-500/30 rounded-3xl text-center animate-msg">
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block mb-2">Processamento de DNA</span>
          <h3 className="text-white font-black uppercase text-lg">Diretoria Executiva</h3>
          <p className="text-white/40 text-[10px] mt-2 italic">A Expertise Técnica</p>
        </div>

        {/* Linha de Conexão */}
        <div className="w-0.5 h-12 bg-gradient-to-b from-purple-500 to-gray-500"></div>

        {/* Camada 4: Output UAU - Alterado de Verde para Grafite */}
        <div className="w-[300px] p-6 bg-gray-500/20 border border-gray-500/40 rounded-3xl text-center shadow-[0_0_40px_rgba(107,114,128,0.2)] animate-msg">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Output Nível 04</span>
          <h3 className="text-white font-black uppercase text-xl tracking-tighter">ENTREGA U.A.U</h3>
          <div className="mt-2 text-[10px] font-black text-gray-400 flex justify-center gap-4">
             <span>ROI 110%</span>
             <span>DECISÃO</span>
          </div>
        </div>
      </div>

      {/* Decorative Glows */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-bitrix-accent/10 rounded-full blur-[120px] -ml-64 -mb-64"></div>
    </div>
  );
};

export default CircuitB;
