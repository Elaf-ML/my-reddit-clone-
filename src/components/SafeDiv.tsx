import React, { useEffect, useRef } from 'react';

interface SafeDivProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * SafeDiv component that removes the bis_skin_checked attribute
 * to prevent React hydration warnings
 */
const SafeDiv: React.FC<SafeDivProps> = ({ children, ...props }) => {
  const divRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Remove the bis_skin_checked attribute after mounting
    if (divRef.current) {
      divRef.current.removeAttribute('bis_skin_checked');
    }
  }, []);
  
  return <div ref={divRef} {...props}>{children}</div>;
};

export default SafeDiv; 