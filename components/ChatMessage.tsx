
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender, PersonaConfig } from '../types';
import { CheckIcon, XIcon, PencilIcon, FileTextIcon } from './Icon';
import { Avatar } from './Avatar';

interface ChatMessageProps {
    message: Message;
    directors: PersonaConfig[];
    agentContext?: { name: string, avatarUrl?: string };
    onEdit?: (msg: Message, newText: string, newAttachment?: { data: string, mimeType: string, preview: string } | null) => void;
}

const DOUGLAS_IMAGE = "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&q=80&w=200&h=200";
const PIETRO_IMAGE = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&q=80&w=200&h=200";

const ChatMessage: React.FC<ChatMessageProps> = ({ message, directors, agentContext, onEdit }) => {
    const isBot = message.sender === Sender.Bot;
    const isSystem = message.sender === Sender.System;

    // --- ESTADO LOCAL DE EDIÇÃO ---
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(message.text);
    const [editedAttachment, setEditedAttachment] = useState(message.attachment);
    const editFileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditedText(message.text);
        setEditedAttachment(message.attachment);
    }, [message.text, message.attachment]);

    const handleSave = () => {
        if ((editedText.trim() !== message.text || editedAttachment !== message.attachment) && onEdit) {
            onEdit(message, editedText, editedAttachment);
        }
        setIsEditing(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedAttachment({
                    data: reader.result as string,
                    mimeType: file.type,
                    preview: URL.createObjectURL(file)
                });
            };
            reader.readAsDataURL(file);
        }
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
            const fallbackSpeaker = message.participantName || agentContext?.name || 'Pietro Carboni';
            return [{
                speaker: fallbackSpeaker,
                content: text,
                imageUrl: agentContext?.avatarUrl || PIETRO_IMAGE
            }];
        }
        return parts;
    };

    const messageParts = parseBotParts(message.text);
    const messageAttachments = (Array.isArray(message.attachments) && message.attachments.length > 0)
        ? message.attachments
        : (message.attachment ? [message.attachment] : []);

    return (
        <div className={`flex w-full mb-4 animate-msg ${isBot ? 'justify-start' : 'justify-end'}`}>

            {messageParts.map((part, index) => (
                // REMOVED 'flex-row-reverse' for User. Now both follow 'flex-row' logic (Avatar -> Bubble) or consistent Left-Avatar layout?
                // User Request: "Avatar do Usuario deverã ficar do lado esquerdo da caixa de mensagem dele."
                // Current User Logic: flex-row-reverse (Bubble ... Avatar).
                // New User Logic: flex-row (Avatar ... Bubble). 
                // BUT `justify-end` keeps the block on the right.
                <div key={index} className={`flex items-start gap-4 max-w-[95%] md:max-w-[85%] ${isBot ? 'flex-row' : 'flex-row'}`}>

                    <div className="flex flex-col items-center shrink-0 mt-1">
                        <Avatar
                            name={part.speaker}
                            url={part.imageUrl || undefined}
                            className="w-10 h-10 rounded-xl shadow-sm border border-white"
                        />
                    </div>

                    {/* --- BLOCO DE CONTEÚDO --- */}
                    <div className={`flex flex-col min-w-0 ${isBot ? 'items-start' : 'items-end'}`} style={{ minWidth: (part.speaker.length * 9) + 20 }}>

                        {/* HEADER: Nome */}
                        <div className={`flex items-end mb-1 px-1 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                            <span className={`text-[10px] font-black tracking-widest truncate ${isBot ? 'text-gray-400' : 'text-indigo-400'}`}>
                                {part.speaker}
                            </span>
                        </div>

                        {/* BUBBLE (FIXED VISUALS - PURPLE & FIT) */}
                        <div className={`
                    px-5 py-3 rounded-2xl relative text-sm leading-relaxed shadow-sm w-fit max-w-full
                    ${isBot
                                ? 'bg-white text-gray-700 rounded-tl-sm border border-gray-100 prose prose-sm max-w-none prose-p:text-gray-700 prose-p:mb-1 prose-a:text-blue-600 prose-strong:text-gray-900'
                                : 'bg-purple-50 text-gray-800 rounded-tr-sm border border-purple-100 font-medium'
                            }
                `}>
                            {isEditing ? (
                                <div className="flex flex-col gap-2 min-w-[280px] md:min-w-[400px]">
                                    <textarea
                                        value={editedText}
                                        onChange={(e) => setEditedText(e.target.value)}
                                        className="w-full bg-white/50 border border-indigo-100 rounded-lg p-3 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all resize-none min-h-[100px]"
                                        autoFocus
                                    />

                                    {/* Edit Mode Attachment Preview/Add */}
                                    <div className="flex items-center gap-2 px-1">
                                        <input
                                            type="file"
                                            ref={editFileInputRef}
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <button
                                            onClick={() => editFileInputRef.current?.click()}
                                            className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2 text-[10px] font-bold"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            {editedAttachment ? "Trocar Arquivo" : "Anexar Arquivo"}
                                        </button>

                                        {editedAttachment && (
                                            <div className="flex items-center gap-2 p-1 bg-indigo-50 rounded-lg border border-indigo-100">
                                                <img src={editedAttachment.preview} className="w-6 h-6 rounded object-cover" />
                                                <button onClick={() => setEditedAttachment(null)} className="text-red-400 hover:text-red-600">
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={handleCancel} className="text-[10px] font-bold text-gray-400 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                                        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center gap-2">
                                            <CheckIcon className="w-3.5 h-3.5" />
                                            Salvar Alterações
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {messageAttachments.length > 0 && (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {messageAttachments.map((file, idx) => (
                                                <div key={`${file.name || 'anexo'}-${idx}`} className="flex items-center gap-2 p-2 bg-black/5 rounded-lg border border-black/5">
                                                    {file.mimeType.startsWith('image/') ? (
                                                        <img
                                                            src={file.preview}
                                                            alt={file.name || 'Anexo'}
                                                            className="w-12 h-12 rounded object-cover border border-white/20 shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded bg-white flex items-center justify-center shadow-sm">
                                                            <FileTextIcon className="w-4 h-4 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] font-bold text-gray-500 truncate max-w-[130px]">{file.name || 'Arquivo'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {isBot ? <ReactMarkdown>{part.content}</ReactMarkdown> : <span>{part.content}</span>}
                                </div>
                            )}
                        </div>

                        {/* FOOTER: Horário e Status */}
                        <div className={`flex items-center gap-3 mt-1.5 px-1 ${isBot ? 'justify-start' : 'justify-end'}`}>
                            {!isBot && onEdit && !isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-[9px] font-bold text-indigo-400/60 hover:text-indigo-600 transition-colors flex items-center gap-1"
                                >
                                    Editar
                                </button>
                            )}
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isBot && <span className="text-[8px] font-black text-indigo-400 uppercase">Lido</span>}
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
