declare module '@emoji-mart/data' {
  const data: any;
  export default data;
}

declare module '@emoji-mart/react' {
  import React from 'react';
  
  interface PickerProps {
    data: any;
    onEmojiSelect: (emoji: any) => void;
    theme?: 'light' | 'dark';
    [key: string]: any;
  }
  
  const Picker: React.FC<PickerProps>;
  export default Picker;
} 