import React from 'react';
import { AvatarColor } from '../types';

interface DefaultAvatarProps {
  color?: AvatarColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  avatarUrl?: string;
  name?: string;
  className?: string;
  isAlphanumeric?: boolean;
}

const colorMap: Record<string, { bg: string; circle: string }> = {
  blue: { bg: '#2563EB', circle: '#3B82F6' },
  yellow: { bg: '#EAB308', circle: '#FACC15' },
  purple: { bg: '#9333EA', circle: '#A855F7' },
  green: { bg: '#10B981', circle: '#34D399' },
  orange: { bg: '#F97316', circle: '#FB923C' },
  pink: { bg: '#EC4899', circle: '#F472B6' }
};

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ 
  color = 'blue', 
  size = 'md', 
  avatarUrl, 
  name,
  className = '',
  isAlphanumeric = false
}) => {
  const [imgError, setImgError] = React.useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const roundedClass = isAlphanumeric ? 'rounded-2xl' : 'rounded-full';
  
  if (avatarUrl && !imgError) {
    return (
      <img 
        src={avatarUrl} 
        alt={name || 'Avatar'} 
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} ${roundedClass} object-cover shadow-sm ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  const activeColor = colorMap[color] || colorMap.blue;
  const avatarPath = `/${color ? `avatar_${color}.png` : 'avatar_blue.png'}`;

  return (
    <div className={`${sizeClasses[size]} ${roundedClass} shadow-md overflow-hidden flex items-center justify-center shrink-0 relative ${className}`}>
      {!imgError ? (
        <img 
          src={avatarPath}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : null}

      {/* High-quality SVG Vector fallback if image missing/error */}
      {imgError && (
        <svg 
          className="w-full h-full" 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="100" height="100" fill={activeColor.bg} />
          <circle cx="50" cy="38" r="18" fill="white" />
          <path d="M18 88C18 70 32 58 50 58C68 58 82 70 82 88V100H18V88Z" fill="white" />
        </svg>
      )}
    </div>
  );
};

