import { FC } from 'react';
import { Outlet } from 'react-router-dom';
import PublicHeader from '../navigation/PublicHeader';
import PublicFooter from '../navigation/PublicFooter';

const PublicLayout: FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};

export default PublicLayout;
