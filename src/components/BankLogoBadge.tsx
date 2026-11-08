import React, { useState } from 'react';
import { cleanBankName } from '@/pages/transfer/BankSelectionPage';

interface BankLogoBadgeProps {
  bankName: string;
  bankLogo?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackInitial?: string;
}

export function getBankBrand(rawBankName: string) {
  const name = cleanBankName(rawBankName || '').toLowerCase();
  
  if (name.includes('opay') || name.includes('paycom')) {
    return {
      name: 'OPay',
      bg: '#00C582',
      textColor: '#FFFFFF',
      type: 'opay',
    };
  }
  if (name.includes('palmpay')) {
    return {
      name: 'PalmPay',
      bg: '#6A1B9A',
      textColor: '#FFD700',
      type: 'palmpay',
    };
  }
  if (name.includes('moniepoint')) {
    return {
      name: 'Moniepoint',
      bg: '#003399',
      textColor: '#FFFFFF',
      type: 'moniepoint',
    };
  }
  if (name.includes('kuda')) {
    return {
      name: 'Kuda Bank',
      bg: '#40196D',
      textColor: '#FFFFFF',
      type: 'kuda',
    };
  }
  if (name.includes('guaranty') || name.includes('gtbank') || name.includes('gtb')) {
    return {
      name: 'GTBank',
      bg: '#DD4F05',
      textColor: '#FFFFFF',
      type: 'gtbank',
    };
  }
  if (name.includes('access')) {
    return {
      name: 'Access Bank',
      bg: '#F36F21',
      textColor: '#FFFFFF',
      type: 'access',
    };
  }
  if (name.includes('zenith')) {
    return {
      name: 'Zenith Bank',
      bg: '#E4002B',
      textColor: '#FFFFFF',
      type: 'zenith',
    };
  }
  if (name.includes('uba') || name.includes('united bank for africa')) {
    return {
      name: 'UBA',
      bg: '#D71920',
      textColor: '#FFFFFF',
      type: 'uba',
    };
  }
  if (name.includes('first bank')) {
    return {
      name: 'First Bank',
      bg: '#002B49',
      textColor: '#F5B335',
      type: 'firstbank',
    };
  }
  if (name.includes('fcmb')) {
    return {
      name: 'FCMB',
      bg: '#5C2D91',
      textColor: '#FFFFFF',
      type: 'fcmb',
    };
  }
  if (name.includes('stanbic')) {
    return {
      name: 'Stanbic IBTC',
      bg: '#0033A0',
      textColor: '#FFFFFF',
      type: 'stanbic',
    };
  }
  if (name.includes('wema') || name.includes('alat')) {
    return {
      name: 'Wema Bank',
      bg: '#800080',
      textColor: '#FFFFFF',
      type: 'wema',
    };
  }
  if (name.includes('providus')) {
    return {
      name: 'Providus Bank',
      bg: '#182238',
      textColor: '#F1C40F',
      type: 'providus',
    };
  }
  if (name.includes('vexa')) {
    return {
      name: 'Vexa',
      bg: '#162353',
      textColor: '#8BE3FF',
      type: 'vexa',
    };
  }

  return {
    name: cleanBankName(rawBankName) || 'Bank',
    bg: '#162353',
    textColor: '#FFFFFF',
    type: 'generic',
  };
}

export function BankLogoBadge({
  bankName,
  bankLogo,
  size = 'md',
  className = '',
  fallbackInitial,
}: BankLogoBadgeProps) {
  const [imgError, setImgError] = useState(false);
  const brand = getBankBrand(bankName);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[8px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-10 h-10 text-[14px]',
    lg: 'w-12 h-12 text-[16px]',
    xl: 'w-14 h-14 text-[20px]',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 16,
    md: 24,
    lg: 30,
    xl: 36,
  }[size];

  if (bankLogo && !imgError) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs border border-slate-100 ${className}`}
      >
        <img
          src={bankLogo}
          alt={bankName}
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Authentic custom SVGs for major institutions
  const renderSvgContent = () => {
    switch (brand.type) {
      case 'opay':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            {/* OPay signature green circle with white rounded ring and center dot */}
            <circle cx="20" cy="20" r="18" fill="#00C582" />
            <circle cx="20" cy="20" r="11" stroke="white" strokeWidth="3.6" />
            <circle cx="20" cy="20" r="3.2" fill="white" />
          </svg>
        );

      case 'palmpay':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#6C2BD9" />
            <path
              d="M20 10C16 14 14 18 14 23C16 23 18 22 20 20C22 22 24 23 26 23C26 18 24 14 20 10Z"
              fill="#FFD700"
            />
            <path d="M20 20V29" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      case 'moniepoint':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#0366D6" />
            <path
              d="M12 28V14L17.5 22.5L20 18.5L22.5 22.5L28 14V28"
              stroke="white"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'kuda':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#40196D" />
            <path
              d="M14 12V28M14 20L25 12M16 18L26 28"
              stroke="white"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'gtbank':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <rect x="2" y="2" width="36" height="36" rx="10" fill="#DD4F05" />
            <text
              x="20"
              y="25"
              fill="white"
              fontSize="16"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              gt
            </text>
            <rect x="25" y="11" width="3.5" height="3.5" fill="white" />
          </svg>
        );

      case 'access':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#001844" />
            <path
              d="M14 15L19 20L14 25M21 15L26 20L21 25"
              stroke="#F36F21"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'zenith':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#E4002B" />
            <path
              d="M13 14H27L13 26H27"
              stroke="white"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'uba':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#D71920" />
            <text
              x="20"
              y="24"
              fill="white"
              fontSize="11"
              fontWeight="900"
              letterSpacing="0.05em"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              UBA
            </text>
          </svg>
        );

      case 'firstbank':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#002B49" />
            <text
              x="20"
              y="26"
              fill="#F5B335"
              fontSize="17"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              F
            </text>
          </svg>
        );

      case 'vexa':
        return (
          <svg width={iconSizes} height={iconSizes} viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#162353" />
            <path
              d="M13 15L20 27L27 15"
              stroke="#8BE3FF"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      default:
        return (
          <span className="font-extrabold uppercase tracking-tight" style={{ color: brand.textColor }}>
            {fallbackInitial || brand.name.slice(0, 2).trim()}
          </span>
        );
    }
  };

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center shrink-0 shadow-xs overflow-hidden ${className}`}
      style={{ backgroundColor: brand.bg }}
      title={brand.name}
    >
      {renderSvgContent()}
    </div>
  );
}
