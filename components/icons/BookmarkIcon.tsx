
import React from 'react';

interface BookmarkIconProps {
    className?: string;
    filled?: boolean;
}

const BookmarkIcon: React.FC<BookmarkIconProps> = ({ className, filled = false }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
);

export default BookmarkIcon;
