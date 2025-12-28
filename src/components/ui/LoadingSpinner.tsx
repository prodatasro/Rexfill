import { FC } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={`${className} flex items-center justify-center`}>
      <div
        className={`animate-spin rounded-full border-2 border-primary-600 border-t-transparent ${sizeClasses[size]}`}
      />
    </div>
  );
};

export default LoadingSpinner;