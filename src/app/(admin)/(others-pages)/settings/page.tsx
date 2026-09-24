import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import SettingsPageContent from '@/components/page-components/SettingsPageContent';
import { Metadata } from 'next';
import React from 'react';

import { getAppMetaTitle } from '@/app/lib/utils/metadata';

export const metadata: Metadata = {
  title: getAppMetaTitle('Settings | VLTX CRM'),
  description: '',
};

export default function SettingsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="settings" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <SettingsPageContent />
      </div>
    </div>
  );
}
