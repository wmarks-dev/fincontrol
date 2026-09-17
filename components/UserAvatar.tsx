import React, { useState } from 'react';

interface UserAvatarProps {
  photoURL?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBorder?: boolean;
}

const sizeConfig = {
  xs: { box: 'w-7 h-7 text-xs rounded-lg' },
  sm: { box: 'w-9 h-9 text-sm rounded-xl' },
  md: { box: 'w-10 h-10 text-sm rounded-xl' },
  lg: { box: 'w-14 h-14 text-xl rounded-2xl' },
  xl: { box: 'w-20 h-20 text-3xl rounded-2xl' },
  '2xl': { box: 'w-24 h-24 text-4xl rounded-3xl' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  name,
  email,
  size = 'md',
  className = '',
  showBorder = true,
}) => {
  const [imageError, setImageError] = useState(false);

  const cfg = sizeConfig[size] || sizeConfig.md;
  const initial = (name?.trim()?.charAt(0) || email?.trim()?.charAt(0) || 'U').toUpperCase();
  const borderClass = showBorder ? 'border border-white/20' : '';

  if (photoURL && !imageError) {
    return (
      <div
        className={`relative overflow-hidden flex-shrink-0 bg-slate-800 shadow-md ${cfg.box} ${borderClass} ${className}`}
      >
        <img
          src={photoURL}
          alt={name || email || 'Foto do perfil'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover select-none"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shadow-md shadow-blue-500/25 select-none ${cfg.box} ${borderClass} ${className}`}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
