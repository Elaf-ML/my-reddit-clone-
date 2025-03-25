import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiInfo, FiAlertTriangle } from 'react-icons/fi';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow animation to complete before removing from DOM
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FiCheck className="w-5 h-5" />;
      case 'error':
        return <FiX className="w-5 h-5" />;
      case 'info':
        return <FiInfo className="w-5 h-5" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-800 border-green-500 dark:bg-green-900/30 dark:text-green-200';
      case 'error':
        return 'bg-red-50 text-red-800 border-red-500 dark:bg-red-900/30 dark:text-red-200';
      case 'info':
        return 'bg-blue-50 text-blue-800 border-blue-500 dark:bg-blue-900/30 dark:text-blue-200';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-500 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getIconStyles = () => {
    switch (type) {
      case 'success':
        return 'text-green-500 dark:text-green-300';
      case 'error':
        return 'text-red-500 dark:text-red-300';
      case 'info':
        return 'text-blue-500 dark:text-blue-300';
      case 'warning':
        return 'text-yellow-500 dark:text-yellow-300';
      default:
        return 'text-gray-500 dark:text-gray-300';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 flex items-center gap-3 max-w-md rounded-lg border-l-4 p-4 shadow-md z-50 ${getStyles()}`}
        >
          <div className={`flex-shrink-0 ${getIconStyles()}`}>
            {getIcon()}
          </div>
          <div className="flex-1 text-sm font-medium">{message}</div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <span className="sr-only">Close</span>
            <FiX className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast; 