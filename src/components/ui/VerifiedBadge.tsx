import React from 'react';
import { CheckCircle } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div className={`inline-flex items-center ${className}`} title="Verified">
      <CheckCircle size={sizeMap[size]} className="text-blue-500 fill-current" />
    </div>
  );
};

export default VerifiedBadge;