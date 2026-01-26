import { FC, useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import InvitationDropdown from './InvitationDropdown';

const NotificationBell: FC = () => {
  const { unreadCount } = useNotifications();
  const { userInvitations } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalUnread = unreadCount + userInvitations.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && <InvitationDropdown onClose={() => setIsOpen(false)} />}
    </div>
  );
};

export default NotificationBell;
