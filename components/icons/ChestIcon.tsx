import React from 'react';

export const ChestIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <rect x="2" y="8" width="20" height="12" rx="2" />
    <path d="M2 8h20" />
    <path d="M12 4v4" />
    <path d="M10 4h4" />
    <path d="M8 8v8" />
    <path d="M16 8v8" />
  </svg>
);
