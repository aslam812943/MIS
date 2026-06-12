import { Toaster } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';

const AppToaster: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          fontSize: '0.875rem',
          boxShadow: isLight ? '0 4px 14px rgba(15, 23, 42, 0.1)' : undefined,
        },
        success: {
          iconTheme: {
            primary: isLight ? '#4338ca' : '#06b6d4',
            secondary: isLight ? '#ffffff' : '#041016',
          },
        },
        error: {
          iconTheme: {
            primary: '#f87171',
            secondary: isLight ? '#ffffff' : '#041016',
          },
        },
      }}
    />
  );
};

export default AppToaster;
