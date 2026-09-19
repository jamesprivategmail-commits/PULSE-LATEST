import React from 'react';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  title?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'sm',
  className = '',
  title = 'Verified'
}) => {
  const sizeMap = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7'
  };

  const dim = sizeMap[size] || sizeMap.sm;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      title={title}
      aria-label="Verified Account"
    >
      <svg
        viewBox="0 0 48 48"
        className={`${dim} drop-shadow-sm select-none`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Pulse Verified Background */}
        <circle cx="24" cy="24" r="22" fill="#1677FF" />

        {/* Precision ring */}
        <circle
          cx="24"
          cy="24"
          r="18.5"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.16"
          strokeWidth="1"
        />

        {/* Custom clean verification mark */}
        <path
          d="M15.5 24.2L21.1 29.8L33 17.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};

