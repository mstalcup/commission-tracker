import { useState } from 'react';
import { ProfileForm } from '../components/ProfileForm';
import { Card, SectionTitle } from '../components/ui';
import { useBusiness } from '../lib/queries';

export function Dashboard() {
  const business = useBusiness();
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="space-y-10">
      {!business.name && !dismissed && (
        <Card className="border-accent/40 p-5 sm:p-6">
          <p className="eyebrow text-accent">Welcome</p>
          <h2 className="display mt-1 text-3xl">Let’s set up your commission book</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Add your business name and website. You can change these any time in Settings.</p>
          <ProfileForm business={business} compact onSaved={() => setDismissed(true)} />
        </Card>
      )}
      <section>
        <SectionTitle>Overview</SectionTitle>
        <Card className="p-6 text-sm text-muted">Your dashboard will appear here.</Card>
      </section>
    </div>
  );
}
