import React from 'react';

interface TypingIndicatorProps {
  names: string[];
  language: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ names, language }) => {
  let label = '';
  if (names.length === 1) label = language === 'en' ? `${names[0]} is typing` : `${names[0]} está escribiendo`;
  else if (names.length === 2) label = language === 'en' ? `${names[0]} and ${names[1]} are typing` : `${names[0]} y ${names[1]} están escribiendo`;
  else if (names.length > 2) label = language === 'en' ? `${names.length} people are typing` : `${names.length} personas están escribiendo`;

  return (
    <div className="flex min-h-[26px] items-center px-4" aria-live="polite" aria-atomic="true">
      {label ? (
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#343e48]/70">
          <span>{label}</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f78c26] motion-safe:animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f78c26] motion-safe:animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f78c26] motion-safe:animate-bounce" />
          </span>
        </div>
      ) : null}
    </div>
  );
};
