import React from 'react';

interface GridShapeProps {
  className?: string;
}

export const GridShape: React.FC<GridShapeProps> = ({ className = '' }) => {
  return (
    <>
      <div
        className={`absolute right-0 top-0 -z-10 w-full max-w-[250px] xl:max-w-[450px] opacity-40 select-none pointer-events-none ${className}`}
      >
        <img src="/images/shape/grid-01.svg" alt="" className="w-full h-auto" />
      </div>
      <div
        className={`absolute left-0 bottom-0 -z-10 w-full max-w-[250px] rotate-180 xl:max-w-[450px] opacity-40 select-none pointer-events-none ${className}`}
      >
        <img src="/images/shape/grid-01.svg" alt="" className="w-full h-auto" />
      </div>
    </>
  );
};

export default GridShape;
