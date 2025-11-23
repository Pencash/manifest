import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export interface FABAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  color?: string;
}

interface MobileFABProps {
  actions: FABAction[];
}

export const MobileFAB = ({ actions }: MobileFABProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isMobile) return null;

  const handleActionClick = (action: FABAction) => {
    action.action();
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Menu */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-3">
        {/* Action Buttons */}
        {isOpen &&
          actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="bg-background px-3 py-1 rounded-md shadow-lg text-sm font-medium whitespace-nowrap">
                  {action.label}
                </span>
                <Button
                  size="icon"
                  className={cn(
                    'h-12 w-12 rounded-full shadow-lg',
                    action.color || 'bg-primary hover:bg-primary/90'
                  )}
                  onClick={() => handleActionClick(action)}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>
            );
          })}

        {/* Main FAB Button */}
        <Button
          size="icon"
          className={cn(
            'h-14 w-14 rounded-full shadow-xl transition-all duration-300',
            isScrolled && !isOpen && 'h-12 w-12',
            'bg-primary hover:bg-primary/90'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div
            className={cn(
              'transition-transform duration-300',
              isOpen && 'rotate-45'
            )}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </div>
        </Button>
      </div>
    </>
  );
};
