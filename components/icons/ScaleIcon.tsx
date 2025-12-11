import React from 'react';

export const ScaleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="22" x2="12" y2="18" />
    <path d="M3 6h18" />
    <path d="M19 6l-4 6h-6l-4-6" />
    <path d="M5 12l4-6" />
    <path d="M19 12l-4-6" />
  </svg>
);
