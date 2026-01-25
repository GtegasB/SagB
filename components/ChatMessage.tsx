
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender, PersonaConfig } from '../types';
import { CheckIcon, XIcon, PencilIcon } from './Icon';
import { Avatar } from './Avatar'; 

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
    <div className={`flex w-full mb-4 animate-msg ${isBot ? 'justify-start' : 'justify-end'}`}>
      
      {messageParts.map((part, index) => (
        <div key={index} className={`flex items-start gap-3 max-w-[90%] md:max-w-[80%] ${isBot ? '' : 'flex-row-reverse'}`}>
            
            {/* --- AVATAR --- */}
            <div className="flex flex-col items-center shrink-0">
                <Avatar 
                    name={part.speaker} 
                    url={part.imageUrl || undefined} 
                    className={`w-10 h-10 rounded-xl shadow-sm border border-gray-100 ${isBot ? 'grayscale' : ''}`} 
                />
            </div>

            {/* --- BLOCO DE CONTEÚDO --- */}
            <div className={`flex flex-col min-w-0 ${isBot ? 'items-start' : 'items-end'}`}>
                
                {/* HEADER: Nome + Label */}
                <div className={`flex items-end mb-1 px-1 gap-2 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px] ${isBot ? 'text-gray-400' : 'text-blue-400'}`}>
                        {part.speaker}
                    </span>
                    
                    {!isBot && !isEditing && (
                        <div className="flex items-center gap-2">
                             {onEdit && (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="text-[9px] font-black text-blue-300 uppercase tracking-tighter hover:text-blue-500 transition-colors flex items-center gap-1"
                                >
                                    <PencilIcon className="w-2.5 h-2.5" />
                                    Editar
                                </button>
                             )}
                        </div>
                    )}
                </div>

                {/* BUBBLE (FIXED VISUALS - BLUE & FIT) */}
                <div className={`
                    px-5 py-3 rounded-2xl relative text-sm leading-relaxed shadow-sm w-fit max-w-full
                    ${isBot 
                        ? 'bg-white text-gray-700 rounded-tl-sm border border-gray-100 prose prose-sm max-w-none prose-p:text-gray-700 prose-p:mb-1 prose-a:text-blue-600 prose-strong:text-gray-900' 
                        : 'bg-blue-500/10 text-gray-800 rounded-tr-sm border border-blue-500/10 font-medium' 
                    }
                `}>
                    {isEditing ? (
                        <div className="flex flex-col gap-2 min-w-[300px]">
                            <textarea 
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full bg-white/50 border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all resize-none min-h-[100px]"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                                <button onClick={handleCancel} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Cancelar">
                                    <XIcon className="w-4 h-4" />
                                </button>
                                <button onClick={handleSave} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors flex items-center gap-2">
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
                <div className={`flex items-center gap-2 mt-1 px-1 ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isBot && <span className="text-[8px] font-black text-blue-400 uppercase">Lido</span>}
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
