
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender, PersonaConfig } from '../types';
import { CheckIcon, XIcon, PencilIcon } from './Icon';
import { Avatar } from './Avatar'; // VITAL: Importando o componente unificado

interface ChatMessageProps {
  message: Message;
  directors: PersonaConfig[];
  agentContext?: { name: string, avatarUrl?: string };
  onEdit?: (msg: Message, newText: string) => void;
}

const DOUGLAS_IMAGE = "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FScreenshot_79.png?alt=media&token=1b6c2884-ae4d-49de-9d03-f0a38e0cfc27";
const PIETRO_IMAGE = "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FPietro%20Carboni%20Foto%20Avatar.png?alt=media&token=082e13ca-7cc8-4316-bd9e-24af3b08deb2";

const ChatMessage: React.FC<ChatMessageProps> = ({ message, directors, agentContext, onEdit }) => {
  const isBot = message.sender === Sender.Bot;
  const isSystem = message.sender === Sender.System;
  
  // --- ESTADO LOCAL DE EDIÇÃO ---
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);

  useEffect(() => {
      setEditedText(message.text);
  }, [message.text]);

  const handleSave = () => {
      if (editedText.trim() !== message.text && onEdit) {
          onEdit(message, editedText);
      }
      setIsEditing(false);
  };

  const handleCancel = () => {
      setEditedText(message.text);
      setIsEditing(false);
  };

  // --- SYSTEM MESSAGE ---
  if (isSystem) {
    return (
      <div className="flex justify-center w-full py-4 animate-msg">
        <div className="px-6 py-2 bg-gray-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-3 shadow-sm border border-gray-100">
           <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
           {message.text}
        </div>
      </div>
    );
  }

  // --- PARSE BOT PARTS (Para Agentes) ---
  const parseBotParts = (text: string) => {
    if (!isBot) return [{ speaker: 'Douglas Rodrigues', content: text, imageUrl: DOUGLAS_IMAGE }];
    
    const parts: { speaker: string; content: string; imageUrl?: string | null }[] = [];
    const regex = /\[([^\]]+)\]:\s*([\s\S]*?)(?=\s*\[|$)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const speakerName = match[1].trim();
      
      let imageUrl = null;
      const director = directors.find(d => speakerName.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]));
      
      if (director?.imageUrl) {
          imageUrl = director.imageUrl;
      } else if (agentContext && speakerName.toLowerCase().includes(agentContext.name.toLowerCase().split(' ')[0])) {
          imageUrl = agentContext.avatarUrl;
      } else if (speakerName.toLowerCase().includes('pietro')) {
          imageUrl = PIETRO_IMAGE;
      }

      parts.push({
        speaker: director ? director.name : speakerName,
        content: match[2].trim(),
        imageUrl: imageUrl
      });
    }

    if (parts.length === 0) {
        return [{ 
            speaker: agentContext?.name || 'Pietro Carboni', 
            content: text, 
            imageUrl: agentContext?.avatarUrl || PIETRO_IMAGE 
        }];
    }
    return parts;
  };

  const messageParts = parseBotParts(message.text);

  return (
    <div className={`flex w-full mb-6 animate-msg ${isBot ? 'justify-start' : 'justify-end'}`}>
      
      {messageParts.map((part, index) => (
        <div key={index} className="flex items-start gap-3 max-w-[90%] md:max-w-[75%] w-full">
            
            {/* --- AVATAR (USANDO COMPONENTE INTELIGENTE) --- */}
            <div className="flex flex-col items-center shrink-0">
                <Avatar 
                    name={part.speaker} 
                    url={part.imageUrl || undefined} 
                    className={`w-10 h-10 rounded-xl shadow-sm border border-gray-100 ${isBot ? 'grayscale' : ''}`} 
                />
            </div>

            {/* --- BLOCO DE CONTEÚDO --- */}
            <div className="flex flex-col flex-1 min-w-0">
                
                {/* HEADER: Nome + Label */}
                <div className={`flex items-end mb-1 px-1 ${isBot ? 'justify-start' : 'justify-between'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px] ${isBot ? 'text-gray-300 ml-1' : 'text-gray-400'}`}>
                        {part.speaker}
                    </span>
                    
                    {!isBot && !isEditing && (
                        <div className="flex items-center gap-2">
                             {onEdit && (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="text-[9px] font-black text-[#6366F1]/40 uppercase tracking-tighter hover:text-[#6366F1] transition-colors flex items-center gap-1"
                                >
                                    <PencilIcon className="w-2.5 h-2.5" />
                                    Editar
                                </button>
                             )}
                        </div>
                    )}
                </div>

                {/* BUBBLE (ROYAL AI STYLE) */}
                <div className={`
                    p-4 rounded-2xl rounded-tl-none relative
                    shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.03)]
                    ${isBot 
                        ? 'bg-white text-gray-700 prose prose-sm max-w-none prose-p:text-gray-700 prose-p:mb-1 prose-a:text-blue-600 prose-strong:text-gray-900' 
                        : 'bg-gradient-to-r from-[#6366F1]/5 to-[#8B5CF6]/5 text-gray-800 border border-[#6366F1]/10 font-medium' 
                    }
                `}>
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <textarea 
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full bg-white/50 border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 transition-all resize-none min-h-[100px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                                <button onClick={handleCancel} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Cancelar">
                                    <XIcon className="w-4 h-4" />
                                </button>
                                <button onClick={handleSave} className="px-3 py-1.5 bg-[#6366F1] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#4F46E5] transition-colors flex items-center gap-2">
                                    <CheckIcon className="w-3 h-3" />
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    ) : (
                        isBot ? <ReactMarkdown>{part.content}</ReactMarkdown> : part.content
                    )}
                </div>

                {/* FOOTER: Horário e Status */}
                <div className="flex justify-end items-center gap-2 mt-2 px-1">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter italic">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isBot && <span className="text-[9px] font-black text-[#6366F1] uppercase">Lido</span>}
                </div>

                {/* Streaming Indicator */}
                {message.isStreaming && isBot && (
                    <div className="pl-2 pt-1">
                        <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      ))}
    </div>
  );
};

export default ChatMessage;
