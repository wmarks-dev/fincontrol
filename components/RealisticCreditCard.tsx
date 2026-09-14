import React from 'react';

export type CardThemeKey = 'black' | 'purple' | 'emerald' | 'blue' | 'gold' | 'rose';

export interface CardThemeConfig {
  id: CardThemeKey;
  name: string;
  bgGradient: string;
  textColor: string;
  subtextColor: string;
  chipType: 'gold' | 'silver';
  brand: 'mastercard' | 'visa';
  borderClass: string;
  glowColor: string;
  previewBg: string;
}

export const CARD_THEMES: Record<CardThemeKey, CardThemeConfig> = {
  black: {
    id: 'black',
    name: 'Black Titanium',
    bgGradient: 'from-zinc-950 via-slate-900 to-zinc-900',
    textColor: 'text-zinc-100',
    subtextColor: 'text-zinc-400',
    chipType: 'silver',
    brand: 'mastercard',
    borderClass: 'border-white/15',
    glowColor: 'rgba(255, 255, 255, 0.08)',
    previewBg: 'bg-zinc-800',
  },
  purple: {
    id: 'purple',
    name: 'Nubank Violet',
    bgGradient: 'from-violet-950 via-purple-900 to-indigo-950',
    textColor: 'text-white',
    subtextColor: 'text-purple-200/70',
    chipType: 'gold',
    brand: 'mastercard',
    borderClass: 'border-purple-400/30',
    glowColor: 'rgba(147, 51, 234, 0.35)',
    previewBg: 'bg-purple-600',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    bgGradient: 'from-teal-950 via-emerald-900 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-emerald-200/70',
    chipType: 'gold',
    brand: 'visa',
    borderClass: 'border-emerald-400/30',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    previewBg: 'bg-emerald-600',
  },
  blue: {
    id: 'blue',
    name: 'Platinum Blue',
    bgGradient: 'from-slate-950 via-blue-900 to-indigo-950',
    textColor: 'text-white',
    subtextColor: 'text-blue-200/70',
    chipType: 'silver',
    brand: 'visa',
    borderClass: 'border-blue-400/30',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    previewBg: 'bg-blue-600',
  },
  gold: {
    id: 'gold',
    name: 'Luxury Gold',
    bgGradient: 'from-amber-950 via-yellow-900 to-stone-950',
    textColor: 'text-amber-100',
    subtextColor: 'text-amber-300/70',
    chipType: 'gold',
    brand: 'mastercard',
    borderClass: 'border-amber-400/30',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    previewBg: 'bg-amber-500',
  },
  rose: {
    id: 'rose',
    name: 'Sunset Rose',
    bgGradient: 'from-rose-950 via-pink-900 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-pink-200/70',
    chipType: 'gold',
    brand: 'mastercard',
    borderClass: 'border-pink-400/30',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    previewBg: 'bg-pink-600',
  },
};

export const getCardTheme = (themeKey?: string, cardName?: string): CardThemeConfig => {
  if (themeKey && themeKey in CARD_THEMES) {
    return CARD_THEMES[themeKey as CardThemeKey];
  }
  
  const lower = (cardName || '').toLowerCase();
  if (lower.includes('nu') || lower.includes('rox') || lower.includes('violet')) return CARD_THEMES.purple;
  if (lower.includes('inter') || lower.includes('gold') || lower.includes('ouro') || lower.includes('amarelo')) return CARD_THEMES.gold;
  if (lower.includes('sicredi') || lower.includes('green') || lower.includes('verde') || lower.includes('bb')) return CARD_THEMES.emerald;
  if (lower.includes('ita') || lower.includes('blue') || lower.includes('azul') || lower.includes('bradesco')) return CARD_THEMES.blue;
  if (lower.includes('rose') || lower.includes('rosa')) return CARD_THEMES.rose;
  
  return CARD_THEMES.black;
};

const Chip: React.FC<{ type: 'gold' | 'silver' }> = ({ type }) => {
  const isGold = type === 'gold';
  return (
    <div
      className={`w-10 h-7.5 sm:w-11 sm:h-8 rounded-md p-0.5 relative overflow-hidden shadow-inner border ${
        isGold
          ? 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border-amber-300/60'
          : 'bg-gradient-to-br from-slate-200 via-zinc-300 to-slate-400 border-white/60'
      }`}
    >
      <div className="w-full h-full border border-black/20 rounded-sm grid grid-cols-2 grid-rows-3 gap-0.5 opacity-60">
        <div className="border-r border-b border-black/30"></div>
        <div className="border-b border-black/30"></div>
        <div className="border-r border-b border-black/30"></div>
        <div className="border-b border-black/30"></div>
        <div className="border-r border-b border-black/30"></div>
        <div></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none"></div>
    </div>
  );
};

const ContactlessIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5 opacity-75 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M7 16a5 5 0 0 1 0-8" />
    <path d="M10 19a9 9 0 0 0 0-14" />
    <path d="M13 22a13 13 0 0 0 0-20" />
  </svg>
);

const BrandLogo: React.FC<{ brand: 'mastercard' | 'visa' }> = ({ brand }) => {
  if (brand === 'visa') {
    return (
      <span className="font-black italic text-lg sm:text-xl tracking-tighter text-white select-none drop-shadow">
        VISA
      </span>
    );
  }
  return (
    <div className="flex -space-x-3 items-center select-none drop-shadow">
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-600/95 shadow-sm"></div>
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400/95 shadow-sm mix-blend-screen"></div>
    </div>
  );
};

interface RealisticCreditCardProps {
  name: string;
  dueDay: number;
  closingDay: number;
  themeKey?: string;
  cardId?: string;
  className?: string;
  interactive?: boolean;
}

export const RealisticCreditCard: React.FC<RealisticCreditCardProps> = ({
  name,
  dueDay,
  closingDay,
  themeKey,
  cardId,
  className = '',
  interactive = true,
}) => {
  const theme = getCardTheme(themeKey, name);

  // Derive stylish 4 digits from card ID or default
  const last4 = cardId ? cardId.replace(/[^0-9]/g, '').slice(-4).padStart(4, '8') : '4291';

  return (
    <div
      className={`relative aspect-[1.586/1] w-full rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 ${
        theme.borderClass
      } border bg-gradient-to-tr ${theme.bgGradient} ${
        interactive ? 'hover:scale-[1.02] hover:-translate-y-1' : ''
      } ${className}`}
      style={{
        boxShadow: `0 20px 35px -10px ${theme.glowColor}, 0 10px 15px -5px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Glossy / metallic reflection lines */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] via-white/[0.08] to-transparent pointer-events-none"></div>
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/[0.06] blur-2xl pointer-events-none"></div>
      <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-black/40 blur-2xl pointer-events-none"></div>

      {/* Top Row: Card/Bank Name & Contactless */}
      <div className="relative z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`font-extrabold tracking-widest text-xs sm:text-sm uppercase drop-shadow truncate max-w-[180px] sm:max-w-[220px] ${theme.textColor}`}>
            {name || 'FinControl Card'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/80 uppercase tracking-wide border border-white/10 flex-shrink-0">
            Crédito
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ContactlessIcon />
        </div>
      </div>

      {/* Middle Row: Chip & Masked Number */}
      <div className="relative z-10 flex items-center justify-between my-auto">
        <Chip type={theme.chipType} />
        <div className="font-mono text-xs sm:text-base tracking-[0.22em] text-white/90 drop-shadow font-bold select-none">
          •••• {last4}
        </div>
      </div>

      {/* Bottom Row: Cycle info & Brand */}
      <div className="relative z-10 flex justify-between items-end">
        <div>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/50 font-medium">Ciclo da Fatura</p>
          <p className={`text-xs sm:text-sm font-bold tracking-wide tabular-nums ${theme.textColor}`}>
            Fech. dia {closingDay || '—'} • Venc. dia {dueDay || '—'}
          </p>
        </div>
        <BrandLogo brand={theme.brand} />
      </div>
    </div>
  );
};
export default RealisticCreditCard;
