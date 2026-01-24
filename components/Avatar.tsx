
import React, { useState, useEffect } from 'react';
import { getAvatarForAgent } from '../utils/avatars';

interface AvatarProps {
  name: string;
  className?: string;
  url?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({ name, className = "w-10 h-10", url, onClick }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Reinicia estado quando o nome muda
  useEffect(() => {
    setHasError(false);
    // Prioriza URL direta, senão busca do utilitário
    setImgSrc(url || getAvatarForAgent(name));
  }, [name, url]);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Cores de fundo para fallback baseadas no nome (consistência visual)
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
  ];
  const colorIndex = name.length % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div 
      onClick={onClick}
      className={`${className} rounded-2xl overflow-hidden shrink-0 shadow-sm border border-gray-100 bg-white flex items-center justify-center relative ${onClick ? 'cursor-pointer' : ''}`}
    >
      {!hasError && imgSrc ? (
        <img 
          src={imgSrc} 
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className={`w-full h-full ${bgColor} flex items-center justify-center text-white font-black text-xs tracking-widest`}>
          {initials}
        </div>
      )}
    </div>
  );
};
