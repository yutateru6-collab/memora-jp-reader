import React from 'react';

const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
    <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" />
  </svg>
);

export default PauseIcon;