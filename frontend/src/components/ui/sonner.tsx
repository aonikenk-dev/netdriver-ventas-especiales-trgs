import { Toaster as Sonner } from 'sonner';

function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#FFFFFF',
          border: '1px solid #D7DCE3',
          color: '#15181C',
          fontSize: '0.85rem',
        },
      }}
    />
  );
}

export { Toaster };
export { toast } from 'sonner';
