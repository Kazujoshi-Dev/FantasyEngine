import React from 'react';

export const AnvilIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M20 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8" />
    <path d="M4 8c0-1.5.6-3 2-4" />
    <path d="M18 4c1.4 1 2 2.5 2 4" />
    <path d="M6 15H4" />
    <path d="M20 15h-2" />
    <path d="M12 4V2" />
    <path d="M12 15v-3" />
  </svg>
);
