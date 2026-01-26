import { FC } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const PublicFooter: FC = () => {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { href: '/#features', label: t('navigation.features') },
      { href: '/pricing', label: t('navigation.pricing') },
      { href: '/guides', label: t('navigation.guides') },
    ],
    company: [
      { href: '/contact', label: t('navigation.contact') },
    ],
    legal: [
      { href: '/privacy', label: t('footer.privacy') },
      { href: '/terms', label: t('footer.terms') },
    ],
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('/#')) {
      e.preventDefault();
      const sectionId = href.substring(2); // Remove '/#'
      
      // If not on landing page, navigate there first
      if (location.pathname !== '/') {
        navigate('/');
        // Wait for navigation to complete, then scroll
        setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        // Already on landing page, just scroll
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <img
                src={isDarkMode ? '/logo-dark.svg' : '/logo-light.svg'}
                alt="Rexfill"
                className="h-8"
              />
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              {t('footer.description')}
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              {t('footer.product')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith('/#') ? (
                    <a
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              {t('footer.company')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              {t('footer.legal')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            © {currentYear} Rexfill. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
