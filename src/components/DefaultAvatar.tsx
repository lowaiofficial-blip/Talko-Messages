import React from 'react';
import { AvatarColor } from '../types';
import { AlertOctagon, Ban } from 'lucide-react';

interface DefaultAvatarProps {
  color?: AvatarColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  avatarUrl?: string;
  name?: string;
  className?: string;
  isAlphanumeric?: boolean;
  isSpam?: boolean;
  isBlocked?: boolean;
  talkoNumber?: string;
}

export const SILHOUETTE_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2MzY2RkNSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE0OCIgcj0iNzIiIGZpbGw9IiNmZmZmZmYiLz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMjAwIDI4MEMyNjAgMjM0IDMyMCAyNjUgMzQyIDM0NUMzNDUgMzYwIDM0NSA0MDAgMzQ1IDQwMEw1NSA0MDBDNTUgNDAwIDU1IDM2MCA1OCAzNDVDODAgMjY1IDE0MCAyMzAgMjAwIDI4MFoiLz48L3N2Zz4=";

export const SilhouetteAvatarSVG: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg 
    className={`w-full h-full object-cover ${className}`} 
    viewBox="0 0 400 400" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="400" height="400" fill="#c3cdd5" />
    <circle cx="200" cy="148" r="72" fill="#ffffff" />
    <path 
      fill="#ffffff" 
      d="M 200 230 C 260 230 320 265 342 345 C 345 360 345 400 345 400 L 55 400 C 55 400 55 360 58 345 C 80 265 140 230 200 230 Z" 
    />
  </svg>
);

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
  isAlphanumeric = false,
  isSpam = false,
  isBlocked = false,
  talkoNumber
}) => {
  const [imgError, setImgError] = React.useState(false);

  const isSilhouette = 
    talkoNumber?.includes('882 9407') || 
    talkoNumber?.includes('8829407') || 
    name?.includes('882 9407') || 
    name?.includes('8829407') ||
    avatarUrl === SILHOUETTE_AVATAR ||
    avatarUrl?.includes('data:image/svg+xml');

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 32,
    xl: 48
  };

  const roundedClass = isAlphanumeric ? 'rounded-2xl' : 'rounded-full';

  // 1. SPAM AVATAR PROFILE (Mat Gri Metal Uyarı Levhası + Kırmızı Ünlem)
  if (isSpam) {
    return (
      <div 
        className={`${sizeClasses[size]} ${roundedClass} bg-gradient-to-b from-gray-700 via-gray-800 to-gray-900 border-2 border-gray-600 shadow-xl overflow-hidden flex flex-col items-center justify-center shrink-0 relative ${className}`}
        title="Spam Gönderici"
      >
        <div className="w-full h-full flex items-center justify-center bg-black/40">
          <span className="text-red-500 font-black font-mono leading-none select-none flex items-center justify-center" style={{ fontSize: size === 'sm' ? '20px' : size === 'md' ? '26px' : size === 'lg' ? '36px' : '54px' }}>
            !
          </span>
        </div>
      </div>
    );
  }

  // 2. BLOCKED AVATAR PROFILE (Gri Arka Plan + Yasak / Ban İkonu)
  if (isBlocked) {
    return (
      <div 
        className={`${sizeClasses[size]} ${roundedClass} bg-gray-900 border-2 border-gray-700 shadow-md overflow-hidden flex items-center justify-center shrink-0 relative ${className}`}
        title="Engellenen Kullanıcı"
      >
        <Ban size={iconSizes[size]} className="text-red-500 stroke-[2.5]" />
      </div>
    );
  }

  // 3. CUSTOM IMAGE AVATAR PROFILE (If a custom avatarUrl exists and is not SILHOUETTE_AVATAR)
  if (avatarUrl && avatarUrl !== SILHOUETTE_AVATAR && !imgError) {
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

  // 4. SILHOUETTE AVATAR PROFILE (Grauer Hintergrund + Weiße Silhouette for +90 850 882 9407 or default SILHOUETTE_AVATAR)
  if (isSilhouette) {
    return (
      <div className={`${sizeClasses[size]} ${roundedClass} shadow-md overflow-hidden shrink-0 ${className}`}>
        <SilhouetteAvatarSVG />
      </div>
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

