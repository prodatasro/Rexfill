import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Settings, CreditCard, Activity, Database } from 'lucide-react';

export type ProfileSection = 'profile' | 'settings' | 'subscription' | 'activity' | 'data';

interface ProfileNavigationProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
}

export const ProfileNavigation: FC<ProfileNavigationProps> = ({ activeSection, onSectionChange }) => {
  const { t } = useTranslation();

  const navItems: { id: ProfileSection; icon: typeof User; labelKey: string }[] = [
    { id: 'profile', icon: User, labelKey: 'profile.nav.profile' },
    { id: 'settings', icon: Settings, labelKey: 'profile.nav.settings' },
    { id: 'subscription', icon: CreditCard, labelKey: 'profile.nav.subscription' },
    { id: 'data', icon: Database, labelKey: 'profile.nav.data' },
    { id: 'activity', icon: Activity, labelKey: 'profile.nav.activity' },
  ];

  return (
    <nav className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 h-fit sticky top-6">
      <div className="space-y-2">
        {navItems.map(({ id, icon: Icon, labelKey }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={20} />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
