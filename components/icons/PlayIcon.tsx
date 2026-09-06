import React from 'react';

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"}>
    <path d="M8 5V19L19 12L8 5Z" />
  </svg>
);

export default PlayIcon;