
import React from 'react';

export const CrossedSwordsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M14.5 17.5 3 6" />
    <path d="m21 3-3.5 3.5" />
    <path d="M9.5 17.5 21 6" />
    <path d="m3 21 3.5-3.5" />
  </svg>
);
