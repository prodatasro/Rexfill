import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Settings, CreditCard, Activity, ChevronDown } from 'lucide-react';
import { ProfileSection } from './ProfileNavigation';

interface ProfileMobileNavProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
}

export const ProfileMobileNav: FC<ProfileMobileNavProps> = ({ activeSection, onSectionChange }) => {
  const { t } = useTranslation();

  const navItems: { id: ProfileSection; icon: typeof User; labelKey: string }[] = [
    { id: 'profile', icon: User, labelKey: 'profile.nav.profile' },
    { id: 'settings', icon: Settings, labelKey: 'profile.nav.settings' },
    { id: 'subscription', icon: CreditCard, labelKey: 'profile.nav.subscription' },
    { id: 'activity', icon: Activity, labelKey: 'profile.nav.activity' },
  ];

  const activeItem = navItems.find(item => item.id === activeSection);
  const ActiveIcon = activeItem?.icon || User;

  return (
    <div className="lg:hidden mb-6">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {t('profile.nav.section')}
      </label>
      <div className="relative">
        <select
          value={activeSection}
          onChange={(e) => onSectionChange(e.target.value as ProfileSection)}
          className="w-full appearance-none pl-11 pr-10 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          {navItems.map(({ id, labelKey }) => (
            <option key={id} value={id}>
              {t(labelKey)}
            </option>
          ))}
        </select>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ActiveIcon size={20} className="text-slate-600 dark:text-slate-400" />
        </div>
        <ChevronDown
          size={20}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none"
        />
      </div>
    </div>
  );
};
