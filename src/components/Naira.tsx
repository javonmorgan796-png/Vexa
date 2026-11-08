import React from 'react';

interface NairaProps {
  className?: string;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
}

export const Naira: React.FC<NairaProps> = ({ className = '', size }) => {
  const sizeClasses =
    size === 'xs' ? 'text-[11px]' :
    size === 'sm' ? 'text-[13px]' :
    size === 'lg' ? 'text-[18px]' :
    size === 'xl' ? 'text-[24px]' : '';

  return (
    <span
      className={`font-sans font-extrabold inline-block mr-0.5 select-none tracking-tight leading-none opacity-95 ${sizeClasses} ${className}`}
      style={{
        verticalAlign: 'baseline',
        fontFeatureSettings: '"tnum" 1',
        textRendering: 'geometricPrecision',
      }}
      aria-label="NGN"
    >
      ₦
    </span>
  );
};

export default Naira;
